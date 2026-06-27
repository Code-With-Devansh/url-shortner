export const toUserDTO = (user) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  avatar: user.avatar,
  isVerified: user.isVerified,
  createdAt: user.createdAt?.toISOString() || new Date().toISOString(),
});

export const toLoginResponseDTO = (user, accessToken) => ({
  success: true,
  data: {
    user: { ...toUserDTO(user) },
    accessToken,
  },
  message: "User logged in successfully",
});

export const toRegisterResponseDTO = (user) => ({
  success: true,
  data: { user: toUserDTO(user) },
  message: "User registered successfully",
});

export const toAuthResponseDTO = (message, success = true) => ({
  success,
  message,
});
