const { Page, User } = require("../db");
const s3Service = require('../services/s3.service');


// Create a new page
exports.createPage = async (req, res) => {
  try {
    const { pageName, pageUrl, accessToken, facebookPageId } = req.body;
    const userId = req.params.userId;

    if (!pageName || !pageUrl || !accessToken) {
      return res.status(400).json({ message: "Missing required fields: pageName, pageUrl, accessToken" });
    }

    const resolvedFacebookPageId =
      facebookPageId ||
      pageUrl
        .replace(/^https?:\/\/(www\.)?facebook\.com\//i, "")
        .split("?")[0]
        .split("/")[0];

    if (!resolvedFacebookPageId) {
      return res.status(400).json({ message: "facebookPageId is required." });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found." });

    if (user.accountbalance < 2) {
      return res.status(402).json({ message: "Insufficient account balance." });
    }

    // Handle image uploads if they exist
    let profileImageUrl = req.body.profileImage || null;
    let coverImageUrl = req.body.coverImage || null;

    if (req.files) {
      try {
        // Upload profile image if exists
        if (req.files.profileImage) {
          const profileUpload = await s3Service.uploadImage(req.files.profileImage[0].buffer.toString('base64'));
          profileImageUrl = profileUpload.Location;
        }

        // Upload cover image if exists
        if (req.files.coverImage) {
          const coverUpload = await s3Service.uploadImage(req.files.coverImage[0].buffer.toString('base64'));
          coverImageUrl = coverUpload.Location;
        }
      } catch (uploadError) {
        console.error("Image upload error:", uploadError);
        return res.status(500).json({ message: "Error uploading images to storage" });
      }
    }

    const newPage = new Page({
      user: userId,
      pageName,
      facebookPageId: resolvedFacebookPageId,
      pageUrl,
      profileImage: profileImageUrl,
      coverImage: coverImageUrl,
      accessToken,
    });

    const savedPage = await newPage.save();
    // await User.findByIdAndUpdate(userId, { $inc: { accountbalance: -2 } }, { new: true });
    
    return res.status(201).json({
      success: true,
      message: "Page created successfully",
      page: savedPage
    });

  } catch (error) {
    console.error("Create page error:", error);
    
    if (error.code === 11000) {
      return res.status(400).json({ 
        success: false,
        message: "Page URL already exists." 
      });
    }
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({ 
        success: false,
        message: error.message 
      });
    }
    
    return res.status(500).json({ 
      success: false,
      message: "Internal server error while creating page",
      error: error.message 
    });
  }
};

// Get all pages for a specific user
exports.getPagesByUser = async (req, res) => {
  try {
    const userId = req.params.userId;
    if (!userId) {
      return res.status(400).json({ message: "User ID is required in parameters." });
    }

    const pages = await Page.find({
      $or: [
        { user: userId },
        { assignedUsers: userId }
      ]
    });

    if (pages && pages.length > 0) {
      res.status(200).json(pages);
    } else {
      res.status(404).json({ message: "No pages found for this user." });
    }
  } catch (error) {
    res.status(500).json({ message: "Error fetching pages: " + error.message });
  }
};

// Update a page by ID
exports.updatePage = async (req, res) => {
  try {
    const { pageName, pageUrl, profileImage, coverImage, accessToken, facebookPageId } = req.body;
    const pageId = req.params.pageId;
    const userId = req.params.userId;

    if (!pageId) {
      return res.status(400).json({ message: "Page ID is required in parameters." });
    }

    // Check if the page exists and belongs to the user
    const existingPage = await Page.findOne({ _id: pageId, user: userId });
    if (!existingPage) {
      return res.status(404).json({ message: "Page not found or you don't have permission to update it." });
    }

    // Prepare update fields
    const updateFields = {};
    if (pageName) updateFields.pageName = pageName;
    if (pageUrl) updateFields.pageUrl = pageUrl;
    if (profileImage) updateFields.profileImage = profileImage;
    if (coverImage) updateFields.coverImage = coverImage;
    if (accessToken) updateFields.accessToken = accessToken;
    if (facebookPageId) updateFields.facebookPageId = facebookPageId;

    const updatedPage = await Page.findByIdAndUpdate(
      pageId,
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    if (!updatedPage) {
      return res.status(404).json({ message: "Page not found." });
    }

    res.status(200).json(updatedPage);
  } catch (error) {
    if (error.code === 11000) { // Duplicate key error (for pageUrl)
      return res.status(400).json({ message: "Page URL already exists." });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: "Error updating page: " + error.message });
  }
};

// Delete a page by ID
exports.deletePage = async (req, res) => {
  try {
    const pageId = req.params.pageId;
    const userId = req.params.userId;

    if (!pageId) {
      return res.status(400).json({ message: "Page ID is required in parameters." });
    }

    // Check if the page exists and belongs to the user
    const existingPage = await Page.findOne({ _id: pageId, user: userId });
    if (!existingPage) {
      return res.status(404).json({ message: "Page not found or you don't have permission to delete it." });
    }

    const deletedPage = await Page.findByIdAndDelete(pageId);

    if (!deletedPage) {
      return res.status(404).json({ message: "Page not found." });
    }

    res.status(200).json({ message: "Page deleted successfully." });
  } catch (error) {
    res.status(500).json({ message: "Error deleting page: " + error.message });
  }
};
exports.updatePageImage = async (req, res) => {
  try {
    const pageId = req.params.pageId;

    if (!pageId) {
      return res.status(400).json({ message: "Page ID is required in parameters." });
    }

    // Check if the page exists
    const existingPage = await Page.findById(pageId);
    if (!existingPage) {
      return res.status(404).json({ message: "Page not found." });
    }

    let profileImageUrl = existingPage.profileImage;
    let coverImageUrl = existingPage.coverImage;

    // Handle image uploads if they exist
    if (req.files) {
      try {
        // Upload profile image if exists
        if (req.files.profileImage) {
          const profileUpload = await s3Service.uploadImage(req.files.profileImage[0].buffer.toString('base64'));
          profileImageUrl = profileUpload.Location;
        }

        // Upload cover image if exists
        if (req.files.coverImage) {
          const coverUpload = await s3Service.uploadImage(req.files.coverImage[0].buffer.toString('base64'));
          coverImageUrl = coverUpload.Location;
        }
      } catch (uploadError) {
        console.error("Image upload error:", uploadError);
        return res.status(500).json({ message: "Error uploading images to storage" });
      }
    }

    // Update the page with new images
    existingPage.profileImage = profileImageUrl;
    existingPage.coverImage = coverImageUrl;

    const updatedPage = await existingPage.save();

    res.status(200).json({
      success: true,
      message: "Page images updated successfully",
      page: updatedPage
    });

  } catch (error) {
    console.error("Update page image error:", error);
    res.status(500).json({ message: "Internal server error while updating page images", error: error.message });
  }
}
