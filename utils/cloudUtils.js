const CLOUDINARY_CLOUD_NAME = "dxm8kjgtr";
const CLOUDINARY_UPLOAD_PRESET = "profile_uploads"; // Create unsigned preset in Cloudinary
// const CLOUDINARY_API_KEY = "149252799823773"; // Optional: for deleting images
// const CLOUDINARY_API_SECRET = "9B8Nmj7B6sgtO3fACU8yxPVjRQk";

export const uploadProfileImage = async (imageUri, userId) => {
  try {
    // Create FormData
    const formData = new FormData();

    // Add the image
    formData.append("file", {
      uri: imageUri,
      type: "image/jpeg",
      name: "profile.jpg",
    });

    // Add required Cloudinary parameters
    formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);
    formData.append("cloud_name", CLOUDINARY_CLOUD_NAME);
    formData.append("folder", "profile_images");
    formData.append("public_id", `user_${userId}_${Date.now()}`);

    // Upload to Cloudinary
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
      {
        method: "POST",
        body: formData,
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );

    const result = await response.json();

    if (response.ok && result.secure_url) {
      return result.secure_url; // Return the image URL
    } else {
      throw new Error(result.error?.message || "Upload failed");
    }
  } catch (error) {
    console.error("Cloudinary upload error:", error);
    throw new Error("Failed to upload image");
  }
};
