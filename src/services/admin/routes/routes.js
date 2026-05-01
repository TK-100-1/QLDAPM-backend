import express from "express";
import { authMiddleware } from "../../../middlewares/authMiddleware.js";
import * as authController from "../controllers/authController.js";
import { googleLogin } from "../controllers/googleController.js";
import * as adminController from "../controllers/adminController.js";
import * as userController from "../controllers/userController.js";
import * as paymentController from "../controllers/paymentController.js";
import * as roleController from "../controllers/roleController.js";

import uploadAvatar from "../../../middlewares/upload.js";

function setupAdminRoutes(app) {
  // User Management Routes
  const userRoutes = express.Router();
  userRoutes.use(authMiddleware());
  userRoutes.get("/me", userController.getCurrentUserInfo);
  userRoutes.put("/me", userController.updateUserProfile);
  userRoutes.delete("/me", userController.deleteCurrentUser);
  userRoutes.put("/me/change_password", userController.changePassword);
  userRoutes.put("/me/change_email", userController.changeEmail);
  userRoutes.get("/me/payment-history", userController.getPaymentHistory);
  userRoutes.post(
    "/me/avatar",
    uploadAvatar.single("avatar"),
    userController.uploadAvatar,
  );
  app.use("/api/v1/user", userRoutes);

  // Auth Routes
  const authRoutes = express.Router();
  authRoutes.post("/login", authController.login);
  authRoutes.post("/google-login", googleLogin);
  authRoutes.post("/register", authController.register);
  authRoutes.post("/forgot-password", authController.forgotPassword);
  authRoutes.post("/reset-password", authController.resetPassword);
  authRoutes.post("/refresh-token", authController.refreshToken);
  authRoutes.post(
    "/logout",
    authMiddleware(),
    authController.logout,
  );
  app.use("/api/v1/auth", authRoutes);

  // Admin
  const adminRoutes = express.Router();
  
  // User Management
  adminRoutes.get("/users", authMiddleware("manage_users"), adminController.getAllUsers);
  adminRoutes.post("/user", authMiddleware("manage_users"), adminController.createUserByAdmin);
  adminRoutes.put("/user/:user_id/role", authMiddleware("manage_users"), adminController.changeUserRoleByAdmin);
  adminRoutes.get("/user/:user_id", authMiddleware("manage_users"), adminController.getUserByAdmin);
  adminRoutes.delete("/user/:user_id", authMiddleware("manage_users"), adminController.deleteUserByAdmin);
  adminRoutes.put("/user/:user_id/ban", authMiddleware("manage_users"), adminController.banAccount);
  adminRoutes.put("/user/:user_id/active", authMiddleware("manage_users"), adminController.activeAccount);
  
  // Payment History
  adminRoutes.get(
    "/payment-history",
    authMiddleware("view_payment_history"),
    adminController.getPaymentHistoryForAdmin,
  );
  adminRoutes.get(
    "/payment-history/:user_id",
    authMiddleware("view_payment_history"),
    adminController.getPaymentHistoryOfAUserByAdmin,
  );
  
  // Roles Management
  adminRoutes.get("/roles", authMiddleware("manage_roles"), roleController.getRoles);
  adminRoutes.post("/roles", authMiddleware("manage_roles"), roleController.createRole);
  adminRoutes.put("/roles/:id", authMiddleware("manage_roles"), roleController.updateRole);
  adminRoutes.delete("/roles/:id", authMiddleware("manage_roles"), roleController.deleteRole);

  app.use("/api/v1/admin", adminRoutes);

  // Payment Routes
  const paymentRoutes = express.Router();
  paymentRoutes.get("/roles", authMiddleware(), roleController.getRoles);
  paymentRoutes.post(
    "/vip-upgrade",
    authMiddleware(),
    paymentController.createVIPPayment,
  );
  paymentRoutes.post("/status", paymentController.handleQueryPaymentStatus);
  paymentRoutes.post("/sepay-webhook", paymentController.sepayWebhook);
  app.use("/api/v1/payment", paymentRoutes);
}

export { setupAdminRoutes };
