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

export const toAuthResponseDTO = (message, token, success = true) => ({
  success,
  data: token ? { token } : {},
  message,
});

export const toVerificationLinkResponseDTO = (sessionToken, success = true) => ({
  success,
  data: { sessionToken },
  message: "Verification Link Sent",
});
 