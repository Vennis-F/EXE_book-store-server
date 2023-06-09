const { auth } = require("../middlewares/auth");
const authorize = require("../middlewares/authorize");
const Cart = require("../models/cart");
const router = require("express").Router();
const validator = require("validator");
const Order = require("../models/order");
const {
  isValidCartItem,
  cartPopulateCartItem,
  updateNewProductCartItem,
  isValidCartItemGuest,
  completeCart,
  updateNewProductCartItemCustomer,
} = require("../utils/cart");
const Product = require("../models/product");
const User = require("../models/user");
const Role = require("../models/role");
const { sendEmail } = require("../emails/account");

//POST /checkout (not check exist cart or cart empty)
router.post("/", auth, authorize("customer"), async (req, res) => {
  try {
    //Check all cart item is valid
    //Check lại vì trong lúc mình đặt hàng có thể đã hết hàng
    const cart = await Cart.findOne({ user: req.user._id });
    let msgNotEQuantity = await isValidCartItem(cart);

    //If not response 400
    if (msgNotEQuantity.length > 0)
      return res.status(400).send({ error: msgNotEQuantity });

    //Send status 200
    await updateNewProductCartItemCustomer(cart);
    await cart.save();
    res.send();
  } catch (error) {
    console.log(error);
    res.status(500).send({ error });
  }
});

//POST /checkout (not check exist cart or cart empty)
router.post("/guest", async (req, res) => {
  try {
    //Check all cart item is valid
    //Check lại vì trong lúc mình đặt hàng có thể đã hết hàng
    let cart = req.session.cartGuest;

    //Update lại product cart
    await updateNewProductCartItem(cart);
    completeCart(cart);
    let msgNotEQuantity = await isValidCartItemGuest(cart);

    //If not response 400
    if (msgNotEQuantity.length > 0)
      return res.status(400).send({ error: msgNotEQuantity });

    //Send status 200
    res.send();
  } catch (error) {
    console.log(error);
    res.status(500).send({ error });
  }
});

/*FLOW PROGRAM
  CHƯA TỪNG CÓ ORDER
  - Case 1: không có order và session:
  + get: trả về 404 và undefined
  + post: tạo data, nếu sai thì bắt tạo lại, nếu đúng return data và SET SESSION
  - Case 2: Có session: (giống như là quay lại cart hay gì đó)
  + get: nhận data từ session
  + post: NO
  CÓ ORDER:
  - Case 1: có order và không có session:
  + get: lấy DATA từ order và SET SESSION
  + post: NO
  - Case 2: Có session: (giống như là quay lại cart hay gì đó)
  + get: nhận data từ session
  + post: NO
*/

//GET /checkout/receive-information
router.get(
  "/receive-information",
  auth,
  authorize("customer"),
  async (req, res) => {
    try {
      //Nếu có session
      if (req.session.receiverInfo) return res.send(req.session.receiverInfo);

      //Nếu là user, nhưng không có session: return data and setSession cho nó
      const { fullName, email, gender, phone, address } = req.user;
      const receiverInfo = { fullName, email, gender, phone, address };
      req.session.receiverInfo = receiverInfo;

      res.send(receiverInfo);
    } catch (error) {
      res.status(500).send({ error: error.message });
    }
  }
);

//GET /checkout/receive-information
router.get("/receive-information/guest", async (req, res) => {
  try {
    //Nếu có session
    if (req.session.receiverInfo) return res.send(req.session.receiverInfo);
    res.send({});
  } catch (error) {
    console.log(error);
    res.status(500).send({ error: error.message });
  }
});

//LƯU ĐỊA CHỈ: invalid return 400 or 500, valid return info và lưu vào session
//POST /checkout/receive-information (case all field are full)
router.post("/receive-inforamation", async (req, res) => {
  const { fullName, email, gender, phone, address, note } = req.body;

  try {
    //Check exist
    if (!address || !phone || !fullName || !gender || !email)
      return res.sendStatus(400);

    //Check empty string
    if (
      !address.trim() ||
      !phone.trim() ||
      !fullName.trim() ||
      !phone.trim() ||
      !email.trim()
    )
      return res.sendStatus(400);

    //Check valid phoneNumber:
    if (!validator.isMobilePhone(phone.trim()))
      return res.status(400).send({ error: "Số điện thoại không hợp lệ" });

    //Set receive information to session
    const receiverInfo = {
      fullName: fullName.trim(),
      email: email.trim(),
      gender: gender.trim(),
      phone: phone.trim(),
      address: address.trim(),
      note: note?.trim(),
    };
    req.session.receiverInfo = receiverInfo;
    req.session.save(function (err) {
      return Promise.resolve();
    });
    console.log("[Recevie Information API] ", {
      session: req.session,
      id: req.session.id,
    });

    res.send(receiverInfo);
  } catch (error) {
    console.log(error);
    res.status(500).send({ error });
  }
});

//BUTTON XÁC NHẬN THANH TOÁN, nhận DATA từ session
//POST /checkout/confirm (not check cart or session)
router.post("/confirm", auth, authorize("customer"), async (req, res) => {
  try {
    //Check receiverInfor data exist
    console.log(
      "[Confirm API] ",
      {
        session: req.session,
        id: req.session.id,
      },
      req.body
    );

    if (!req.session.receiverInfo)
      return res
        .status(400)
        .send({ error: "Session receiverInfor data not exist" });

    //Check cart exist and cart.items length !== 0
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart || cart.items.length === 0)
      return res
        .status(400)
        .send({ error: "Cart is not exist or Cart items length 0" });

    //Check lại vì trong lúc mình đặt hàng có thể đã hết hàng
    let msgNotEQuantity = await isValidCartItem(cart);
    if (msgNotEQuantity.length > 0)
      return res.status(400).send({ error: msgNotEQuantity });

    //Create overiew order
    const {
      address,
      fullName: receiverName,
      phone,
      email,
      gender,
      note,
    } = req.session.receiverInfo;
    const noteMoMo = req?.body?.params?.noteMoMo;
    const order = new Order({
      owner: req.user._id,
      totalCost: cart.totalCost,
      items: cart.items,
      address,
      receiverName,
      phone,
      email,
      gender,
      note: noteMoMo ? noteMoMo : note,
      status: "submitted",
    });

    //Save order
    const savedOrder = await order.save();

    res.status(201).send(savedOrder);
  } catch (error) {
    console.log(error);
    res.status(400).send({ error });
  }
});

//POST /checkout/confirm (not check cart or session)
router.post("/confirm/guest", async (req, res) => {
  try {
    //Check receiverInfor data exist
    if (!req.session.receiverInfo)
      return res
        .status(400)
        .send({ error: "Session receiverInfor data not exist" });

    //Check cart exist and cart.items length !== 0
    let cart = req.session.cartGuest;
    await updateNewProductCartItem(cart);

    if (!cart || cart.items.length === 0)
      return res
        .status(400)
        .send({ error: "Cart is not exist or Cart items length 0" });

    //Check lại vì trong lúc mình đặt hàng có thể đã hết hàng
    let msgNotEQuantity = await isValidCartItemGuest(cart);
    if (msgNotEQuantity.length > 0)
      return res.status(400).send({ error: msgNotEQuantity });

    //Change product obj to productId:
    cart.items.forEach((item) => {
      item.product = item.product._id.toString();
    });

    //Create overiew order
    const {
      address,
      fullName: receiverName,
      phone,
      email,
      gender,
      note,
    } = req.session.receiverInfo;

    const order = new Order({
      owner: cart.user,
      totalCost: cart.totalCost,
      items: cart.items,
      address,
      receiverName,
      phone,
      email,
      gender,
      note,
      status: "submitted",
    });

    await updateNewProductCartItem(cart);

    req.session.save();

    //Create order
    const savedOrder = await order.save();

    res.status(201).send(savedOrder);
  } catch (error) {
    console.log(error);
    res.status(400).send({ error });
  }
});

//POST /checkout/confirm (not check cart or session)
router.patch("/confirm", auth, authorize("customer"), async (req, res) => {
  try {
    //Decrease product quantity:
    const cart = await cartPopulateCartItem(
      await Cart.findOne({ user: req.user._id })
    );

    for (let i = 0; i < cart.items.length; i++) {
      const item = cart.items[i];
      const product = cart.items[i].product;
      await Product.findByIdAndUpdate(
        product._id,
        {
          quantity: product.quantity - item.quantity,
        },
        { new: true, runValidators: true }
      );
    }

    //Empty cart
    cart.items = [];
    cart.totalAmount = 0;
    cart.save({ validateModifiedOnly: true });

    //Empty receiverInfor data
    req.session.receiverInfo = "";

    //Tạo một object
    const roleSaler = await Role.findOne({ name: "saler" });
    const lstSaler = await User.find({ role: roleSaler._id, status: true });
    await Promise.all(lstSaler.map((saler) => saler.populate("orders")));
    console.log(lstSaler);

    res.send();
  } catch (error) {
    console.log(error);
    res.status(400).send({ error });
  }
});

//POST /checkout/confirm (not check cart or session)
router.patch("/confirm/guest", async (req, res) => {
  try {
    //Decrease product quantity:
    let cart = req.session.cartGuest;
    await updateNewProductCartItem(cart);

    for (let i = 0; i < cart.items.length; i++) {
      const item = cart.items[i];
      const product = cart.items[i].product;

      await Product.findByIdAndUpdate(
        product._id,
        {
          quantity: product.quantity - item.quantity,
        },
        { new: true, runValidators: true }
      );
    }

    //Empty cart
    req.session.cartGuest.items = [];
    req.session.cartGuest.totalCost = 0;
    req.session.receiverInfo = "";

    req.session.save();
    res.send();
  } catch (error) {
    console.log(error);
    res.status(400).send({ error });
  }
});

module.exports = router;
