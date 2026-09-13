const express = require("express");
const app = express();
const jwt = require("jsonwebtoken");

const ConnectDB = require("./Controllers/ConnectB");
const auth = require("./Middleware/auth");
const { dirname } = require("path");
const { fileURLToPath } = require("url");
const path = require("path");

const DataModel = require("./Models/dataModel");

// const __dirname = dirname(fileURLToPath(import.meta.url));
// ROUTERS
const purchaseRouter = require("./Routes/purchaseRouter");
const usersRouter = require("./Routes/usersRouter");
const fundWalletRouter = require("./Routes/fundWalletRouter");
const adminRouter = require("./Routes/adminRouter");
const transactionRoute = require("./Routes/transactionsRouter");
const webhookRoute = require("./Routes/webhookRoutes");
const dataPlanRoutes = require("./Routes/dataPlanRoutes");

// API Management (new — additive, does not touch existing /api/v1 routes)
const apiV2Router = require("./Routes/apiV2Router");
const adminApiManagementRouter = require("./Routes/adminApiManagementRouter");
const apiUserRouter = require("./Routes/apiUserRouter");
const adminUserPricingRouter = require("./Routes/adminUserPricingRouter");

// extra security packages
const helmet = require("helmet");
const cors = require("cors");
const xss = require("xss-clean");
const rateLimiter = require("express-rate-limit");
const morgan = require("morgan");

// Swagger
const swaggerUI = require("swagger-ui-express");
const YAML = require("yamljs");

const PORT = process.env.PORT || 5000;
// Middleware
app.use(cors());

require("dotenv").config();
app.set("trust proxy", 1);
// app.use(
//   rateLimiter({
//     windowMs: 15 * 60 * 1000, // 15 minutes
//     max: 100, // limit each IP to 100 requests per windowMs
//   })
// );
app.use(express.json());
app.use(helmet());
app.use(xss());

app.all("/api/v1/prices", async (req, res) => {
  const { network } = req.body;
  const token = req.header("x-auth-token");
  let isAdmin = false;
  if (token) {
    try {
      const verified = jwt.verify(token, process.env.JWT_SECRET);
      req.user = verified;
      isAdmin = req.user.userId === process.env.ADMIN_ID;
    } catch {
      return res
        .status(401)
        .json({ msg: "Token verification failed, authorization denied" });
    }
  }
  try {
    let queryObj = {};
    if (network) {
      queryObj.plan_network = network;
    }
    let dataList = DataModel.find(queryObj);
    if (!isAdmin)
      dataList.select(
        "-planCostPrice -volumeRatio -partnerPrice -planSupplier"
      );
    dataList = await dataList;
    return res.status(200).json(dataList);
  } catch (e) {
    console.log(e);
    return res.status(500).json({ msg: "An error occur" });
  }
});

// if (process.env.NODE_ENV !== "production") {
app.use(morgan("dev"));
// }

// Public, unauthenticated interactive documentation for external developers
// integrating with /api/v2. helmet's default CSP blocks the inline scripts
// swagger-ui-express's bundled page uses to boot itself, so it's relaxed
// only for this one route — the rest of the app keeps helmet's full CSP.
const swaggerDocument = YAML.load(path.join(__dirname, "docs/openapi.yaml"));
app.use(
  "/api-docs",
  (req, res, next) => {
    res.removeHeader("Content-Security-Policy");
    next();
  },
  swaggerUI.serve,
  swaggerUI.setup(swaggerDocument, {
    customSiteTitle: "Assalam Telecom API Docs",
  })
);

app.get("/api-docs/API_MANAGEMENT.md", (req, res) => {
  res.type("text/plain").sendFile(path.join(__dirname, "API_MANAGEMENT.md"));
});

app.use("/api/v1/auth", usersRouter);
app.use("/api/v1/buy", auth, purchaseRouter);
app.use("/api/v1/fundWallet", fundWalletRouter);
// Mounted before the general /api/v1/admin router so this more specific
// path is matched first (kept this way for clarity, though Express would
// also fall through correctly either order since adminRouter has no
// matching route under /api-management).
app.use("/api/v1/admin/api-management", adminApiManagementRouter);
app.use("/api/v1/admin/user-pricing", adminUserPricingRouter);
app.use("/api/v1/admin", adminRouter);
app.use("/api/v1/transaction", auth, transactionRoute);
app.use("/api/v1/webhook", webhookRoute);
app.use("/api/v1/dataPlan", dataPlanRoutes);
// Internal: a logged-in API User manages their own credentials/webhook
app.use("/api/v1/api-user", apiUserRouter);

// Public, stable developer-facing API — authenticated via API key, NOT the website JWT
app.use("/api/v2", apiV2Router);
app.use(cors({
  origin: "https://sppclient.onrender.com",   // <-- your deployed frontend URL
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));


app.use("/api/v1/*", (req, res) => {
  console.log(req.body);
  res.status(200).json({ msg: "API is working fine" });
});
// ONLY WHEN READY TO DEPLOY

const start = async () => {
  try {
    await ConnectDB(process.env.MONGODB_URI);
    app.listen(PORT, () =>
      console.log(`DB CONNECTED & app listening on port: ${PORT}...`)
    );
  } catch (error) {
    console.log(error.message);
  }
};

// const __dirname = dirname(fileURLToPath(import.meta.url));
app.use(express.static(__dirname + "/client/build"));

app.get("*", (req, res) => {
  res.sendFile(path.resolve(__dirname, "./client/build", "index.html"));
});

start();
