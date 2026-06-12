import { auth, currentUser } from "@clerk/nextjs/server";
import dbConnect from "./db/mongodb";
import User from "@/models/User";
import Institute from "@/models/Institute";
import { ROLE_MAP, DEFAULT_ROLE, INSTITUTE_NAME } from "@/config/appConfig";
import { cache } from "react";

// ============================================================
// AUTO-PROVISIONING AUTH
// On first login, automatically creates a User + Institute
// based on the email→role mapping in config/appConfig.js
// TODO: Replace hardcoded role logic with DB-based roles
// ============================================================

export const getAuthUser = cache(async function getAuthUser() {
  await dbConnect();

  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  // FAST PATH: Lookup user by clerk_id directly.
  // This bypasses the slow currentUser() network call to Clerk's backend.
  let user = await User.findOne({ clerk_id: userId }).exec();
  if (user) {
    return user;
  }

  // SLOW PATH: First time login or manual sync required. Call Clerk API.
  const clerkUser = await currentUser();
  if (!clerkUser) throw new Error("Unauthorized");
  
  const email = clerkUser.emailAddresses?.[0]?.emailAddress || "";

  if (email) {
    let userByEmail = await User.findOne({ phoneOrEmail: new RegExp(`^${email}$`, "i") }).sort({ updatedAt: -1 }).exec();
    if (userByEmail) {
      if (userByEmail.clerk_id !== userId) {
        await User.updateMany({ clerk_id: userId }, { $unset: { clerk_id: 1 } });
        userByEmail.clerk_id = userId;
        const clerkName = `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim();
        if (!userByEmail.name && clerkName) userByEmail.name = clerkName;
        await userByEmail.save();
      }
      return userByEmail;
    }
  }

  // Completely new auto-provisioning
  const name = `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim() || email;

  // TODO: Replace hardcoded role logic with DB-based roles
  const role = ROLE_MAP[email.toLowerCase()] || DEFAULT_ROLE;
  
  console.log("=== AUTH DEBUG ===");
  console.log("Clerk Email:", email);
  console.log("Evaluated Role:", role);
  console.log("ROLE_MAP Keys:", Object.keys(ROLE_MAP));

  // Multi-Tenancy: Create a distinct Institute for each Admin based on their email.
  // If a non-admin logs in and hasn't been invited (no pre-existing user record), reject them.
  let institute;
  if (role === "ADMIN") {
    const instituteName = `School of ${email}`;
    institute = await Institute.findOne({ name: instituteName });
    if (!institute) {
      institute = await Institute.create({
        name: instituteName,
        owner_name: name,
        email: email,
        phone: "+910000000000", // Default since it wasn't asked during Google Login
      });
    }
  } else {
    throw new Error("Access Denied: You must be invited by an Administrator to join a school.");
  }

  // Create user in DB
  user = await User.create({
    name,
    phoneOrEmail: email,
    role,
    institute_id: institute._id,
    clerk_id: userId,
  });

  return user;
});

export async function requireRole(allowedRoles) {
  const user = await getAuthUser();
  if (!allowedRoles.includes(user.role)) {
    throw new Error("Forbidden: Invalid Role");
  }
  return user;
}
