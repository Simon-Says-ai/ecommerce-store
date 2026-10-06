import User from "../models/user.model.js";
import jwt from "jsonwebtoken";
import { redis } from "../lib/redis.js"

const generateToken = (userId) => {
    const accessToken = jwt.sign({ userId }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "15m" });
    const refreshToken = jwt.sign({ userId }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: "7d" });
    return { accessToken, refreshToken };
};

const storeRefreshToken = async (userId, refreshToken) => {
    await redis.set(`refreshToken:${userId}`, refreshToken, "EX", 7 * 24 * 60 * 60); // Store for 7 days
}

const setCookies = ( res, accessToken, refreshToken) =>{
    res.cookie("accessToken", accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite:"strict",
        maxAge: 15 * 60 * 1000, // 15 minutes
    });
    res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite:"strict",
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
};

export const signup = async (req, res) => {
    const {email,password,name} = req.body;
   try { 
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "User already exists" });
    }
  const user = await User.create({ email, password, name });

  const { accessToken, refreshToken } = generateToken(user._id);
  await storeRefreshToken(user._id, refreshToken);

  setCookies(res, accessToken, refreshToken);

  res.status(201).json({ 
    user:{
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
    },
    message: "User created successfully",
   });
} catch (error) {
    console.log("Error in signup controller", error.message);
  res.status(500).json({ message: error.message });
}
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Added: reject non-string input before it reaches MongoDB
    if (typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({ message: "Invalid input" });
    }

    const user = await User.findOne({ email });

    if (user && (await user.comparePassword(password))) {
      const { accessToken, refreshToken } = generateToken(user._id);
      await storeRefreshToken(user._id, refreshToken);

      setCookies(res, accessToken, refreshToken);

      res.status(200).json({
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        message: "Login successful",
      });
    } else {
      res.status(401).json({ message: "Invalid email or password" });
    }
  } catch (error) {
    console.log("Error in login controller", error.message);
    res.status(500).json({ message: "Something went wrong. Please try again." }); // Changed
  }
};

export const logout = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if(refreshToken) {
      const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);  
      await redis.del(`refreshToken:${decoded.userId}`);
    }
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");
    res.status(200).json({ message: "Logged out successfully" });
  } catch (error) {
    console.log("Error in logout controller", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const refreshToken = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ message: "No refresh token provided" });
    }
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    const storedRefreshToken = await redis.get(`refreshToken:${decoded.userId}`);
    if (storedRefreshToken !== refreshToken) {
      return res.status(401).json({ message: "Invalid refresh token" });
    }
    const accessToken = jwt.sign({ userId: decoded.userId }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: "15m" });
    res.cookie("accessToken", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 15 * 60 * 1000, // 15 minutes
    });
    res.status(200).json({ message: "Access token refreshed" });
  } catch (error) {
    console.log("Error in refreshToken controller", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


export const getProfile = async (req, res) => {
  try {
    res.json(req.user);
  } catch (error) {
    console.log("Error in getProfile controller", error.message);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
