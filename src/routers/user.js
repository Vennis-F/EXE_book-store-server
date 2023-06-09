const { auth } = require("../middlewares/auth");
const authorize = require("../middlewares/authorize");
const User = require("../models/user");
const bcrypt = require("bcryptjs");
const {
  resetPassword,
  verifyAccount,
  passwordNewAccount,
} = require("../emails/account");
const Role = require("../models/role");
const Order = require("../models/order");
const { isValidUpdate } = require("../utils/valid");
const router = require("express").Router();
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const jwt = require("jsonwebtoken");

///////////////////////////////////GUEST
//POST /user/guest
router.post("/guest", async (req, res) => {
  const role = await Role.findOne({
    name: "guest",
  });
  const userId = new ObjectId();
  req.session.guest = {
    _id: userId,
    role,
  };
  req.session.cartGuest = {
    _id: new ObjectId(),
    totalCost: 0,
    items: [],
    user: userId,
  };
  req.session.save();
  console.log("***********");

  try {
    res.status(201).send({
      guest: req.session.guest,
      cartGuest: req.session.cartGuest,
    });
  } catch (error) {
    console.log(error);
    res.status(400).send({
      error: error.message,
    });
  }
});

//POST /user/register
router.post("/register", async (req, res) => {
  const role = await Role.findOne({
    name: "customer",
  });
  try {
    // //Delete session
    // req.session.destroy();
    //Create user
    const user = new User({
      ...req.body,
      role: role._id,
      status: true,
    });
    await user.save();

    //Send email verify
    // const token = await user.generateToken();
    // const url = `http://localhost:5000/verify-account/${token}`;
    // verifyAccount(user.email, url);

    //Create user
    res.status(201).send({
      user,
    });
  } catch (error) {
    console.log("[ERROR /user/register]: ", error.message);
    res.status(400).send({
      error: error.message,
    });
  }
});

//POST /user/verify-account
router.patch("/verify-account/:id", async (req, res) => {
  const { id } = req.params;
  const { token: tokenVerify } = req.body;
  console.log(req.params);
  try {
    const user = await User.findById(id);
    if (!user) return res.sendStatus(404);

    //auto create customer
    console.log(id);
    await user.generateCustomer();
    console.log("----");

    //Clear token verify
    console.log(tokenVerify);
    user.tokens = user.tokens.filter(({ token }) => token !== tokenVerify);
    user.status = true;
    user.save();
    res.status(200).send({
      user,
    });
  } catch (error) {
    console.log(error.message);
    res.status(400).send({
      error: error.message,
    });
  }
});

//POST /user/resend-email-verify
router.post("/resend-email-verify", async (req, res) => {
  try {
    //Create user
    const user = await User.findOne({ email: req.body?.email });

    //Send email verify
    const token = await user.generateToken();
    const url = `http://localhost:5000/verify-account/${token}`;
    verifyAccount(user.email, url);

    res.send();
  } catch (error) {
    console.log(error.message);
    res.status(400).send({
      error: error.message,
    });
  }
});

//POST /user/login
router.post("/login", async (req, res) => {
  try {
    // //Delete session
    // req.session.destroy();

    //Login
    const user = await User.findByCredentials(
      req.body.email,
      req.body.password
    );

    if (!user.status) throw new Error("Your account is not active");

    const token = await user.generateAuthToken();

    res.send({
      user,
      token,
    });
  } catch (error) {
    // console.log(error);
    console.log("[ERROR /user/login]", error.message);
    res.status(400).send({
      error: error.message,
    });
  }
});

//POST /user/logout
router.post("/logout", auth, async (req, res) => {
  try {
    //Delete token
    req.user.tokens = req.user.tokens.filter(
      (token) => token.token !== req.token
    );
    await req.user.save({
      validateModifiedOnly: true,
    });

    //Delete session
    req.session.destroy();
    res.send();
  } catch (e) {
    console.log(e);
    res.status(500).send();
  }
});

//POST /logoutAll
router.post("/logoutAll", auth, async (req, res) => {
  try {
    req.user.tokens = [];
    await req.user.save({
      validateModifiedOnly: true,
    });

    //Delete session
    req.session.destroy();
    res.send();
  } catch (e) {
    console.log(e);
    res.status(500).send();
  }
});

//GET /user/salers
router.get("/salers", async (req, res) => {
  try {
    const roleSaler = await Role.findOne({ name: "saler", status: true });
    const salers = await User.find({ role: roleSaler._id }).populate({
      path: "orders",
    });
    const newSalers = [];
    salers.forEach((saler) => {
      let numStatus = { submitted: 0, cancelled: 0, success: 0 };
      saler.orders.forEach((order) => numStatus[order.status]++);
      newSalers.push({
        _id: saler._id,
        fullName: saler.fullName,
        orders: numStatus,
      });
    });
    res.send(newSalers);
  } catch (error) {
    console.log(error.message);
    res.status(500).send({ error: error.message });
  }
});

//GET /user/profile
//"customer", "marketing", "saler", "saleManager", "admin"
router.get(
  "/profile",
  auth,
  authorize("customer", "marketing", "saler", "saleManager", "admin"),
  async (req, res) => {
    res.send({
      user: req.user,
      role: req.role,
    });
  }
);

//GET /user (get all users)
router.get("/", auth, async (req, res) => {
  try {
    const users = await User.find({});
    res.send(users);
  } catch (e) {
    res.status(500).send(e);
  }
});

//PATCH  /user/profile (only update "fullName", "gender", "phone", "address" !!!not have avatar)
router.patch("/profile", auth, async (req, res) => {
  const updates = Object.keys(req.body);
  const allowUpdateds = ["fullName", "gender", "phone", "address", "avatar"];

  //Check valid update
  const isValid = updates.every((update) => allowUpdateds.includes(update));
  if (!isValid)
    return res.status(400).send({
      error: "Invalid updates",
    });

  try {
    //Update user
    updates.forEach((update) => (req.user[update] = req.body[update]));
    await req.user.save({
      validateModifiedOnly: true,
    });

    console.log(req.user);
    res.send(req.user);
  } catch (error) {
    console.log(error);
    res.status(400).send({
      error: error.message,
    });
  }
});

//PATCH  /user/password (check empty bằng frontend)
router.patch("/new-password", auth, async (req, res) => {
  try {
    const { currPassword, newPassword, confirm } = req.body;

    //Check current password
    const checkPwd = await bcrypt.compare(currPassword, req.user.password);
    if (!checkPwd)
      return res.status(400).send({
        error: "Mật khẩu cũ không đúng",
      });

    //Check newPassword === confirm
    if (newPassword !== confirm)
      return res.status(400).send({
        error: "Mật khẩu mới không giống mật khẩu confirm",
      });

    //Compare password to old password
    const isMatch = await bcrypt.compare(newPassword, req.user.password);
    if (isMatch)
      return res.status(400).send({
        error: "Mật khẩu mới giống với mật khẩu cũ",
      });

    //Change new password
    req.user.password = newPassword;
    await req.user.save();
    res.send(req.user);
  } catch (error) {
    console.log(error);
    return res.status(400).send({
      error: error.message,
    });
    res.status(500).send({
      error,
    });
  }
});

//PATCH /user/role/:id (userId)
router.patch("/role/:id", auth, authorize("admin"), async (req, res) => {
  const updates = Object.keys(req.body);
  const allowUpdateds = ["role"];
  if (!isValidUpdate(updates, allowUpdateds))
    return res.status(400).send({
      error: "Invalid updates",
    });

  try {
    //Check idUser exist
    const user = await User.findById(req.params.id);
    if (!user)
      return res.status(404).send({
        error: "Cannot find user",
      });

    //Check idRole exist
    if (!(await Role.findById(req.body.role)))
      return res.status(404).send({
        error: "Cannot find roleId",
      });

    //Find and Update role
    user.role = req.body.role;

    await user.save();
    res.send(user);
  } catch (e) {
    if (e.name === "CastError" && e.kind === "ObjectId")
      return res.status(400).send({
        error: "Invalid ID",
      });
    res.status(400).send(e.message);
  }
});

//PATCH /user/user/:id (userId)
router.patch("/status/:id", auth, authorize("customer"), async (req, res) => {
  const updates = Object.keys(req.body);
  const allowUpdateds = ["status"];
  if (!isValidUpdate(updates, allowUpdateds))
    return res.status(400).send({
      error: "Invalid updates",
    });

  try {
    //Find and Update user status
    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        status: req.body.status,
      },
      {
        runValidators: true,
        new: true,
      }
    );

    //Find and Check cate exist:
    if (!user) return res.sendStatus(404);
    res.send(user);
  } catch (e) {
    if (e.name === "CastError" && e.kind === "ObjectId")
      return res.status(400).send({
        error: "Invalid ID",
      });
    res.status(400).send(e.message);
  }
});

//POST / user / forgotten
router.post("/forgotten", async (req, res) => {
  const { email } = req.body;
  try {
    if (!email) throw new Error();

    //Check email is exist
    const user = await User.findOne({ email });
    if (!user) return res.sendStatus(404);

    //Generate token
    const token = await user.generateToken();
    const url = `http://localhost:5000/reset-password/${token}`;

    //Send email
    resetPassword(user.email, url);

    // console.log(user);
    res.send();
  } catch (error) {
    console.log(error);
    res.status(400).send({ error });
  }
});

//PATCH  /user/reset-password
router.patch("/reset-password", async (req, res) => {
  console.log(req.body);
  const { password, confirm, token } = req.body;

  try {
    //Check newPassword === confirm
    if (password !== confirm)
      throw new Error("Mật khẩu mới không giống mật khẩu cũ");

    //Verify token
    const decode = jwt.verify(token, "SEC_JWT");
    const user = await User.findOne({ _id: decode._id, "tokens.token": token });

    //Check user not exist
    if (!user) return res.status(404).send({ error: "User is not existed" });

    //Change new password
    user.password = password;

    //Clear token
    const tokenReset = token;
    user.tokens = user.tokens.filter(({ token }) => token !== tokenReset);

    await user.save();
    res.send(req.user);
  } catch (error) {
    return res.status(400).send({
      error: error.message,
    });
  }
});

//POST /user/valid-token
router.post("/valid-token", async (req, res) => {
  const { token } = req.body;
  try {
    //Check token valid and not expire
    jwt.verify(token, "SEC_JWT", (error, decoded) => {
      if (error) throw new Error(error);

      //Check user exist
      User.findById(decoded._id, (err, user) => {
        // console.log(decoded._id);
        // console.log(user);
        if (!user) return res.status(404).send({ error: "User not found" });
        res.send(user);
      });
    });
  } catch (error) {
    console.log("....");
    console.log(error.message);
    res.status(404).send({ error: error.message });
  }
});

////////////////////////////////Admin Role
router.get("/admin/roles", auth, authorize("admin"), async (req, res) => {
  try {
    const roles = await Role.find({});
    res.send(roles);
  } catch (error) {
    res.status(500).send();
  }
});

//POST /user/admin
router.post("/admin", auth, authorize("admin"), async (req, res) => {
  const user = new User(req.body);
  const { password } = req.body;
  try {
    await user.save();

    //send email password:
    passwordNewAccount(user.email, password);
    res.sendStatus(201);
  } catch (error) {
    console.log(error.message);
    res.status(400).send({ error: error.message });
  }
});

//GET /user/admin
//Users lists
//filter : gender, role, status
//gender = [M/F/D]
//sortable: id, fullName, gender, email, phone, role, status
//sortedBy=id_desc //sortedBy=status_asc  ...
//Pagination: limit, page
router.get("/admin", auth, authorize("admin"), async (req, res) => {
  try {
    const { gender, role, status, sortedBy, limit, page } = req.query;
    const match = {};
    const sort = {
      _id: -1,
    };
    const options = {
      sort,
    };

    //filter
    if (status) {
      match.status = status === "true";
    }

    if (gender) {
      match.gender = gender;
    }

    //sort
    if (sortedBy) {
      const parts = sortedBy.split("_");

      if (parts[0] === "id") {
        sort["_id"] = parts[1] === "desc" ? -1 : 1;
        options.sort = sort;
      } else {
        sort[parts[0]] = parts[1] === "desc" ? -1 : 1;
        delete sort._id;
        options.sort = sort;
      }
    }

    //Paging
    if (limit) options.limit = parseInt(limit);
    if (page) options.skip = parseInt(limit) * (parseInt(page) - 1);

    const users = await User.find(match, null, options).populate({
      path: "role",
      select: "name",
    });
    const count = await User.countDocuments(match);

    function compareAsc(a, b) {
      if (a.role.name < b.role.name) {
        return -1;
      }
      if (a.role.name > b.role.name) {
        return 1;
      }
      return 0;
    }

    function compareDesc(a, b) {
      if (a.role.name < b.role.name) {
        return 1;
      }
      if (a.role.name > b.role.name) {
        return -1;
      }
      return 0;
    }

    //sort role
    if (sort.role) {
      if (sort.role === 1) users.sort(compareAsc);
      else users.sort(compareDesc);
    }

    //role filter
    if (role) {
      const sendUsers = users.filter((user) => {
        if (user.role.name.match(new RegExp(role))) return user;
      });
      return res.send({
        users: sendUsers,
        count: sendUsers.length,
      });
    }

    res.send({
      users,
      count,
    });
  } catch (e) {
    res.status(500).send(e.message);
  }
});

//GET /user/admin/search?search=...
//search by fullName, email, phone
//pagination          ?limit=...&page=...
router.post("/admin/search", auth, authorize("admin"), async (req, res) => {
  try {
    let { limit, page, search } = req.body;
    const options = {};

    //Paging
    if (limit) options.limit = parseInt(limit);
    else {
      limit = 5;
    }
    if (page) options.skip = parseInt(limit) * (parseInt(page) - 1);
    else {
      page = 1;
      options.skip = parseInt(limit) * (parseInt(page) - 1);
    }

    //search
    const searchResult = [];
    const checkById = [];

    let name = new RegExp(search, "gi");
    const users = await User.find(
      {
        fullName: name,
      },
      null,
      options
    );
    for (const user of users) {
      if (checkById.length >= limit) break;
      if (!checkById.includes(user._id.toString())) {
        checkById.push(user._id.toString());
        searchResult.push(user);
      }
    }

    if (checkById < limit - 1) {
      let mail = new RegExp(search, "gi");
      const users = await User.find(
        {
          email: mail,
        },
        null,
        options
      );
      for (const user of users) {
        if (checkById.length >= limit) break;
        if (!checkById.includes(user._id.toString())) {
          checkById.push(user._id.toString());
          searchResult.push(user);
        }
      }
    }

    if (checkById < limit - 1) {
      let mobile = new RegExp(search, "gi");
      const users = await User.find(
        {
          phone: mobile,
        },
        null,
        options
      );
      for (let user of users) {
        if (checkById.length >= limit) break;
        if (!checkById.includes(user._id.toString())) {
          checkById.push(user._id.toString());
          searchResult.push(user);
        }
      }
    }

    res.send(searchResult);
  } catch (error) {
    console.log(error);
    res.status(500).send(error);
  }
});

//GET /user/admin/getOne?userID=...
router.get("/admin/getOne", auth, authorize("admin"), async (req, res) => {
  try {
    //Find and Check post exist:
    const user = await User.findById(req.query.userId);
    if (!user) return res.sendStatus(404);

    res.send(user);
  } catch (e) {
    if (e.name === "CastError" && e.kind === "ObjectId")
      return res.status(400).send({
        error: "Invalid ID",
      });
    res.status(500).send(e);
  }
});

//PUT /user/admin/:id
router.put("/admin/", auth, authorize("admin"), async (req, res) => {
  console.log(req.body);
  const updates = Object.keys(req.body);
  const allowUpdateds = [
    "status",
    "role",
    "id",
    "address",
    "email",
    "fullName",
    "phone",
  ];

  if (!isValidUpdate(updates, allowUpdateds))
    return res.status(400).send({
      error: "Invalid updates",
    });

  try {
    const user = await User.findById(req.body?.id);

    if (!user) return res.sendStatus(404);

    updates.forEach((update) => {
      user[update] = req.body[update];
    });
    await user.save();

    res.send(user);
  } catch (e) {
    if (e.name === "CastError" && e.kind === "ObjectId")
      return res.status(400).send({
        error: "Invalid ID",
      });
    res.status(400).send(e.message);
  }
});

// //DELETE /posts/:id
// router.delete('/:id', auth, authorize('marketing'), async (req, res) => {
//   try {
//     const post = await Post.findByIdAndDelete(req.params.id)
//     if (!post)
//       return res.status(404).send()

//     res.send(post)
//   } catch (error) {
//     res.status(500).send(error)
//   }
// })

module.exports = router;
