# AIPICKEDIT Backend API Documentation

**Base URL:** `https://postgen-backend.vercel.app/api`  
**Authentication:** JWT Bearer Token

## Table of Contents

1. [Authentication](#authentication)
2. [Public Endpoints](#public-endpoints)
3. [User Management](#user-management)
4. [Admin Endpoints](#admin-endpoints)
5. [Image Generation](#image-generation)
6. [Video Generation](#video-generation)
7. [Long Video Generation](#long-video-generation)
8. [Page Management](#page-management)
9. [Generation Configuration](#generation-configuration)
10. [Posts Management](#posts-management)
11. [PayPal Integration](#paypal-integration)
12. [Generation Management](#generation-management)
13. [Configs Management](#configs-management)
14. [Data Models](#data-models)
15. [Error Handling](#error-handling)

---

## Authentication

### Register User
**POST** `/api/auth/register`

Creates a new user account.

**Request Body:**
```json
{
  "username": "string (required)",
  "password": "string (required)",
  "role": "string (optional)"
}
```

**Response:**
```json
{
  "message": "User registered successfully",
  "user": {
    "id": "string",
    "username": "string",
    "role": "string",
    "accounttype": "string",
    "regdate": "2024-01-01T00:00:00.000Z",
    "accountbalance": 0,
    "availableStorange": 0,
    "usedStorange": 0
  },
  "token": "jwt_token_here"
}
```

**Error Responses:**
- `400` - Username and password are required
- `409` - Username already exists

### Login User
**POST** `/api/auth/login`

Authenticates a user and returns a JWT token.

**Request Body:**
```json
{
  "username": "string (required)",
  "password": "string (required)"
}
```

**Response:**
```json
{
  "message": "Login successful",
  "user": {
    "id": "string",
    "username": "string",
    "role": "string",
    "accounttype": "string",
    "regdate": "2024-01-01T00:00:00.000Z",
    "accountbalance": 0,
    "availableStorange": 0,
    "usedStorange": 0
  },
  "token": "jwt_token_here"
}
```

**Error Responses:**
- `400` - Username and password are required
- `401` - Invalid credentials

### Get User by ID
**GET** `/api/auth/user/:userId`

Retrieves user information by ID.

**Path Parameters:**
- `userId` (string, required) - User ID

**Response:**
```json
{
  "data": {
    "id": "string",
    "username": "string",
    "role": "string",
    "accounttype": "string",
    "regdate": "2024-01-01T00:00:00.000Z",
    "accountbalance": 0,
    "usedStorange": 0,
    "availableStorange": 0
  }
}
```

**Error Responses:**
- `400` - User ID is required in parameters
- `500` - Error fetching user data

---

## Public Endpoints

### Get Home
**GET** `/`

Returns home page information.

### Get About
**GET** `/about`

Returns about page information.

---

## User Management

### Get User Profile
**GET** `/api/user/profile`

**Authentication:** Required

Retrieves the authenticated user's profile.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "message": "Welcome to your profile, username!",
  "user": {
    "id": "string",
    "username": "string",
    "role": "string"
  }
}
```

**Error Responses:**
- `401` - Not authorized

### Get User Settings
**GET** `/api/user/settings`

**Authentication:** Required

Retrieves user settings.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "message": "User settings page.",
  "user": {
    "id": "string",
    "username": "string",
    "role": "string"
  }
}
```

**Error Responses:**
- `401` - Not authorized

### Update User Storage
**PUT** `/api/user/update/stroange`

Updates user storage information.

**Request Body:**
```json
{
  "packageValue": "number (required)",
  "userId": "string (required)"
}
```

**Response:**
```json
{
  "message": "User storage settings updated successfully."
}
```

**Error Responses:**
- `401` - Package value and user ID are required
- `500` - Error updating user storage settings

---

## Admin Endpoints

### Get Public Users Details
**GET** `/api/admin/public/users-details`

Returns all users with related generations and pages (public endpoint).

**Response:**
```json
{
  "count": "number",
  "data": [
    {
      "user": {
        "id": "string",
        "username": "string",
        "role": "string",
        "accounttype": "string",
        "regdate": "2024-01-01T00:00:00.000Z",
        "accountbalance": 0,
        "availableStorange": 0,
        "usedStorange": 0
      },
      "generationsCount": "number",
      "pages": [
        {
          "_id": "string",
          "user": "string",
          "pageName": "string",
          "pageUrl": "string",
          "profileImage": "string",
          "coverImage": "string"
        }
      ]
    }
  ]
}
```

**Error Responses:**
- `500` - Failed to fetch users details

### Get Admin Dashboard
**GET** `/api/admin/dashboard`

**Authentication:** Required (Admin only)

Returns admin dashboard data.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "message": "Welcome to the Admin Dashboard!",
  "user": {
    "id": "string",
    "username": "string",
    "role": "string"
  }
}
```

**Error Responses:**
- `401` - Not authorized
- `403` - Admin access required

### Get All Users
**GET** `/api/admin/users`

**Authentication:** Required (Admin only)

Returns all users in the system.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "message": "Admin User Management page.",
  "user": {
    "id": "string",
    "username": "string",
    "role": "string"
  },
  "users": []
}
```

**Error Responses:**
- `401` - Not authorized
- `403` - Admin access required

---

## Image Generation

### Generate Images (Auto)
**POST** `/api/image/generate-image`

Generates images automatically based on content.

**Request Body:**
```json
{
  "prompt": "string (required)",
  "numberOfFacts": "number (required)",
  "highlightCount": "number (required)",
  "userId": "string (required)",
  "pageName": "string (required)",
  "pageId": "string (optional)",
  "colors": "object (optional)",
  "noTextOverlay": "boolean (optional)",
  "templateNo": "number (optional)",
  "templateSelectMode": "string (optional)",
  "includePageProfileImage": "boolean (optional)",
  "pageProfileImageUrl": "string (optional)",
  "model": "string (required, enum: ['runaware', 'nano-banana'])"
}
```

**Response:**
```json
{
  "success": true,
  "content": [
    {
      "fact": "string",
      "description": "string",
      "highlights": ["string"]
    }
  ],
  "images": ["string"],
  "cost": "number",
  "model": "string"
}
```

**Error Responses:**
- `400` - Missing required fields or Invalid model
- `402` - Insufficient account balance or storage
- `404` - User not found
- `500` - Internal server error

### Generate Image (Manual)
**POST** `/api/image/generate-image-manual`

Generates images with manual configuration.

**Request Body:**
```json
{
  "facts": [
    {
      "rowData": {
        "fact": "string (required)",
        "description": "string (required)"
      }
    }
  ],
  "highlightCount": "number (required)",
  "userId": "string (required)",
  "pageName": "string (required)",
  "pageId": "string (optional)",
  "colors": "object (optional)",
  "noTextOverlay": "boolean (optional)",
  "templateNo": "number (optional)",
  "templateSelectMode": "string (optional)",
  "includePageProfileImage": "boolean (optional)",
  "pageProfileImageUrl": "string (optional)",
  "model": "string (required, enum: ['runaware', 'nano-banana'])",
  "enhancedPrompt": "string (optional)"
}
```

**Response:**
```json
{
  "success": true,
  "content": [
    {
      "fact": "string",
      "description": "string",
      "highlights": ["string"]
    }
  ],
  "images": ["string"],
  "cost": "number",
  "model": "string"
}
```

**Error Responses:**
- `400` - Missing required fields or Invalid model
- `402` - Insufficient account balance or storage
- `404` - User not found
- `500` - Internal server error

### Generate Images (No Template)
**POST** `/api/image/generate-image-none-template`

Generates images without using templates.

**Request Body:**
```json
{
  "prompt": "string (required)",
  "userId": "string (required)",
  "pageName": "string (required)",
  "pageId": "string (optional)"
}
```

**Response:**
```json
{
  "success": true,
  "content": [
    {
      "fact": "string",
      "description": "string",
      "highlights": ["string"]
    }
  ],
  "images": ["string"],
  "cost": "number",
  "model": "nano-banana"
}
```

**Error Responses:**
- `400` - Missing required fields
- `402` - Insufficient account balance or storage
- `404` - User not found
- `500` - Internal server error

### Generate Image with Prompt
**POST** `/api/image/generate-image-with-prompt`

**Content-Type:** `multipart/form-data`

Generates images using a custom prompt and uploaded image.

**Form Data:**
- `image`: Image file (max 5MB, required)
- `prompt`: Custom prompt text (required)
- `userId`: User ID (required)
- `pageName`: Page name (required)
- `pageId`: Page ID (optional)

**Response:**
```json
{
  "success": true,
  "content": [
    {
      "fact": "string",
      "description": "string",
      "highlights": ["string"]
    }
  ],
  "images": ["string"],
  "cost": "number",
  "model": "gemini-image-prompt"
}
```

**Error Responses:**
- `400` - Missing required fields or No image file provided
- `402` - Insufficient account balance or storage
- `404` - User not found
- `500` - Internal server error

### Overlay Test
**POST** `/api/image/overlay-test`

**Content-Type:** `multipart/form-data`

Tests image overlay functionality.

**Form Data:**
- `image`: Image file (max 5MB, required)

**Response:**
Returns processed image as binary data (image/jpeg)

**Error Responses:**
- `400` - No image file provided
- `500` - Internal server error

---

## Video Generation

### Generate Video
**POST** `/api/video/generate-video`

Generates videos based on provided content.

**Request Body:**
```json
{
  "text_prompt": "string (required)",
  "options": "object (optional)",
  "auto": "boolean (optional)"
}
```

**Response (Async Operation):**
```json
{
  "status": "processing",
  "operation_id": "string",
  "message": "Video generation in progress. Check status later.",
  "status_check_url": "/api/video/status/{operation_id}"
}
```

**Response (Immediate):**
```json
{
  "status": "success",
  "video_url": "string",
  "metadata": "object"
}
```

**Error Responses:**
- `400` - Missing 'text_prompt' in request body
- `502` - Veo API request failed
- `500` - Internal server error

### Check Video Status
**GET** `/api/video/status/:operationId/:type/:userId/:pageId`

Checks the status of a video generation operation.

**Path Parameters:**
- `operationId` (string, required) - Operation ID
- `type` (string, required) - Video type (16:9 or other)
- `userId` (string, required) - User ID
- `pageId` (string, required) - Page ID

**Response:**
```json
{
  "done": "boolean",
  "response": {
    "videos": [
      {
        "gcsUri": "string"
      }
    ]
  },
  "publicUrl": "string (if completed)"
}
```

**Error Responses:**
- `500` - Failed to check video status

---

## Long Video Generation

### Generate Long Video
**POST** `/api/longvideo/generate-long-video`

Generates longer-form videos.

**Request Body:**
```json
{
  "text_prompt": "string (required)",
  "script_promt": "string (optional)",
  "totalDuration": "number (optional, default: 600)",
  "pageId": "string (optional)",
  "userId": "string (required)"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Long video generation started",
  "data": {
    "status": "processing",
    "videoId": "string",
    "totalParts": "number",
    "currentPart": "number",
    "totalDuration": "number",
    "estimatedCost": "number",
    "statusCheckUrl": "/api/longvideo/status/{userId}"
  }
}
```

**Error Responses:**
- `400` - Missing 'text_prompt' in request body or Insufficient account balance
- `401` - User authentication required
- `500` - Failed to start long video generation

### Get Long Video Status
**GET** `/api/longvideo/status/:userId/:videoId`

Checks the status of a long video generation.

**Path Parameters:**
- `userId` (string, required) - User ID
- `videoId` (string, required) - Video ID

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "string",
    "videoId": "string",
    "status": "string",
    "totalParts": "number",
    "completedParts": "number",
    "operationIds": ["string"],
    "videoUrls": ["string"],
    "progress": "number",
    "errors": [
      {
        "operationId": "string",
        "message": "string",
        "timestamp": "2024-01-01T00:00:00.000Z"
      }
    ],
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Error Responses:**
- `404` - No video generation found for this user
- `500` - Failed to get long video status

### Get Long Video URLs
**GET** `/api/longvideo/urls/:userId/:videoId`

Retrieves URLs for generated long videos.

**Path Parameters:**
- `userId` (string, required) - User ID
- `videoId` (string, required) - Video ID

**Response:**
```json
{
  "success": true,
  "data": {
    "videoId": "string",
    "status": "string",
    "totalParts": "number",
    "completedParts": "number",
    "videoUrls": ["string"],
    "progress": "number"
  }
}
```

**Error Responses:**
- `404` - No video generation found for this user
- `500` - Failed to get long video URLs

### Cancel Long Video
**POST** `/api/longvideo/cancel/:userId/:videoId`

Cancels a long video generation operation.

**Path Parameters:**
- `userId` (string, required) - User ID
- `videoId` (string, required) - Video ID

**Response:**
```json
{
  "success": true,
  "message": "Long video generation cancelled",
  "data": {
    "videoId": "string",
    "status": "cancelled"
  }
}
```

**Error Responses:**
- `404` - No active video generation found for this user
- `500` - Failed to cancel long video generation

### Get All Videos
**GET** `/api/longvideo/all/:userId`

Retrieves all videos for a user.

**Path Parameters:**
- `userId` (string, required) - User ID

**Response:**
```json
{
  "success": true,
  "data": {
    "videos": [
      {
        "_id": "string",
        "videoUrls": ["string"],
        "status": "string",
        "totalParts": "number",
        "completedParts": "number",
        "progress": "number",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z",
        "videoType": "16:9",
        "pageName": "Long Video Generation",
        "isLongVideo": true
      }
    ],
    "total": "number"
  }
}
```

**Error Responses:**
- `400` - User ID is required
- `500` - Failed to get videos

---

## Page Management

### Get Pages by User
**GET** `/api/page/getpages/:userId`

Retrieves all pages for a specific user.

**Path Parameters:**
- `userId` (string, required) - User ID

**Response:**
```json
[
  {
    "_id": "string",
    "user": "string",
    "pageName": "string",
    "pageUrl": "string",
    "profileImage": "string",
    "coverImage": "string",
    "accessToken": "string"
  }
]
```

**Error Responses:**
- `400` - User ID is required in parameters
- `404` - No pages found for this user
- `500` - Error fetching pages

### Create Page
**POST** `/api/page/pageadd/:userId`

**Content-Type:** `multipart/form-data`

Creates a new page for a user.

**Path Parameters:**
- `userId` (string, required) - User ID

**Form Data:**
- `pageName` (string, required) - Page name
- `pageUrl` (string, required) - Page URL
- `accessToken` (string, required) - Access token
- `profileImage` (file, optional) - Profile image file (max 5MB)
- `coverImage` (file, optional) - Cover image file (max 5MB)

**Response:**
```json
{
  "success": true,
  "message": "Page created successfully",
  "page": {
    "_id": "string",
    "user": "string",
    "pageName": "string",
    "pageUrl": "string",
    "profileImage": "string",
    "coverImage": "string",
    "accessToken": "string"
  }
}
```

**Error Responses:**
- `400` - Missing required fields or Page URL already exists
- `402` - Insufficient account balance
- `404` - User not found
- `500` - Error uploading images to storage or Internal server error

### Update Page
**PUT** `/api/page/pageupdate/:userId/:pageId`

Updates an existing page.

**Path Parameters:**
- `userId` (string, required) - User ID
- `pageId` (string, required) - Page ID

**Request Body:**
```json
{
  "pageName": "string (optional)",
  "pageUrl": "string (optional)",
  "profileImage": "string (optional)",
  "coverImage": "string (optional)",
  "accessToken": "string (optional)"
}
```

**Response:**
```json
{
  "_id": "string",
  "user": "string",
  "pageName": "string",
  "pageUrl": "string",
  "profileImage": "string",
  "coverImage": "string",
  "accessToken": "string"
}
```

**Error Responses:**
- `400` - Page ID is required in parameters or Page URL already exists
- `404` - Page not found or you don't have permission to update it
- `500` - Error updating page

### Update Page Image
**PUT** `/api/page/update-image/:pageId`

**Content-Type:** `multipart/form-data`

Updates page images.

**Path Parameters:**
- `pageId` (string, required) - Page ID

**Form Data:**
- `profileImage` (file, optional) - Profile image file (max 5MB)
- `coverImage` (file, optional) - Cover image file (max 5MB)

**Response:**
```json
{
  "success": true,
  "message": "Page images updated successfully",
  "page": {
    "_id": "string",
    "user": "string",
    "pageName": "string",
    "pageUrl": "string",
    "profileImage": "string",
    "coverImage": "string",
    "accessToken": "string"
  }
}
```

**Error Responses:**
- `400` - Page ID is required in parameters
- `404` - Page not found
- `500` - Error uploading images to storage or Internal server error

### Delete Page
**DELETE** `/api/page/pagedelete/:userId/:pageId`

Deletes a page.

**Path Parameters:**
- `userId` (string, required) - User ID
- `pageId` (string, required) - Page ID

**Response:**
```json
{
  "message": "Page deleted successfully."
}
```

**Error Responses:**
- `400` - Page ID is required in parameters
- `404` - Page not found or you don't have permission to delete it
- `500` - Error deleting page

---

## Generation Configuration

### Save Generation Configuration
**POST** `/api/generation-config/save`

Saves a new generation configuration.

**Request Body:**
```json
{
  "name": "string (required)",
  "userId": "string (required)",
  "pageId": "string (required)",
  "pageName": "string (required)",
  "mode": "string (required, enum: ['auto', 'manual'])",
  "templateSelectMode": "string (required, enum: ['auto', 'manual'])",
  "templateName": "number (optional, default: 1)",
  "factCount": "number (required, min: 1, max: 25)",
  "numberOfWordsToBeHighlighted": "number (required, min: 1, max: 20)",
  "prompt": "string (required)",
  "colors": {
    "main": "string (required)",
    "child": ["string (required)"]
  },
  "noTextOverlay": "boolean (optional, default: false)",
  "includePageProfileImage": "boolean (optional, default: false)",
  "uploadedData": [
    {
      "rowData": {
        "fact": "string (required)",
        "description": "string (required)"
      }
    }
  ],
  "model": "string (optional)"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Generation configuration saved successfully.",
  "config": {
    "_id": "string",
    "name": "string",
    "user": "string",
    "pageId": "string",
    "pageName": "string",
    "mode": "string",
    "templateSelectMode": "string",
    "templateName": "number",
    "factCount": "number",
    "numberOfWordsToBeHighlighted": "number",
    "prompt": "string",
    "colors": "object",
    "noTextOverlay": "boolean",
    "includePageProfileImage": "boolean",
    "uploadedData": "array",
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "model": "string"
  }
}
```

**Error Responses:**
- `400` - Missing required fields
- `404` - User not found
- `409` - A configuration with this name already exists
- `500` - Internal server error

### Get User Configurations
**GET** `/api/generation-config/user/:userId`

Retrieves all configurations for a user.

**Path Parameters:**
- `userId` (string, required) - User ID

**Response:**
```json
{
  "success": true,
  "configurations": [
    {
      "_id": "string",
      "name": "string",
      "user": "string",
      "pageId": "string",
      "pageName": "string",
      "mode": "string",
      "templateSelectMode": "string",
      "templateName": "number",
      "factCount": "number",
      "numberOfWordsToBeHighlighted": "number",
      "prompt": "string",
      "colors": "object",
      "noTextOverlay": "boolean",
      "includePageProfileImage": "boolean",
      "uploadedData": "array",
      "isActive": true,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z",
      "model": "string"
    }
  ]
}
```

**Error Responses:**
- `400` - User ID is required
- `500` - Internal server error

### Get Configuration by ID
**GET** `/api/generation-config/:configId?userId=:userId`

Retrieves a specific configuration.

**Path Parameters:**
- `configId` (string, required) - Configuration ID

**Query Parameters:**
- `userId` (string, required) - User ID

**Response:**
```json
{
  "success": true,
  "configuration": {
    "_id": "string",
    "name": "string",
    "user": "string",
    "pageId": "string",
    "pageName": "string",
    "mode": "string",
    "templateSelectMode": "string",
    "templateName": "number",
    "factCount": "number",
    "numberOfWordsToBeHighlighted": "number",
    "prompt": "string",
    "colors": "object",
    "noTextOverlay": "boolean",
    "includePageProfileImage": "boolean",
    "uploadedData": "array",
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "model": "string"
  }
}
```

**Error Responses:**
- `400` - Configuration ID and User ID are required
- `404` - Configuration not found
- `500` - Internal server error

### Update Configuration
**PUT** `/api/generation-config/:configId`

Updates an existing configuration.

**Path Parameters:**
- `configId` (string, required) - Configuration ID

**Request Body:**
```json
{
  "name": "string (optional)",
  "userId": "string (required)",
  "pageId": "string (optional)",
  "pageName": "string (optional)",
  "mode": "string (optional, enum: ['auto', 'manual'])",
  "templateSelectMode": "string (optional, enum: ['auto', 'manual'])",
  "templateName": "number (optional)",
  "factCount": "number (optional, min: 1, max: 25)",
  "numberOfWordsToBeHighlighted": "number (optional, min: 1, max: 20)",
  "prompt": "string (optional)",
  "colors": "object (optional)",
  "noTextOverlay": "boolean (optional)",
  "includePageProfileImage": "boolean (optional)",
  "uploadedData": "array (optional)",
  "model": "string (optional)"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Configuration updated successfully.",
  "configuration": {
    "_id": "string",
    "name": "string",
    "user": "string",
    "pageId": "string",
    "pageName": "string",
    "mode": "string",
    "templateSelectMode": "string",
    "templateName": "number",
    "factCount": "number",
    "numberOfWordsToBeHighlighted": "number",
    "prompt": "string",
    "colors": "object",
    "noTextOverlay": "boolean",
    "includePageProfileImage": "boolean",
    "uploadedData": "array",
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z",
    "model": "string"
  }
}
```

**Error Responses:**
- `400` - Configuration ID and User ID are required
- `404` - Configuration not found
- `409` - A configuration with this name already exists
- `500` - Internal server error

### Delete Configuration
**DELETE** `/api/generation-config/:configId?userId=:userId`

Deletes a configuration (soft delete).

**Path Parameters:**
- `configId` (string, required) - Configuration ID

**Query Parameters:**
- `userId` (string, required) - User ID

**Response:**
```json
{
  "success": true,
  "message": "Configuration deleted successfully."
}
```

**Error Responses:**
- `400` - Configuration ID and User ID are required
- `404` - Configuration not found
- `500` - Internal server error

---

## Posts Management

### Get Scheduled Posts
**GET** `/api/posts/getscheduledposts/:userId`

Retrieves scheduled posts for a user.

**Path Parameters:**
- `userId` (string, required) - User ID

**Response:**
```json
{
  "message": "Scheduled Posts retrieved successfully.",
  "generations": [
    {
      "_id": "string",
      "page": "string",
      "posts": [
        {
          "generationId": "string",
          "imageUrl": "string",
          "content": {
            "fact": "string",
            "description": "string",
            "highlights": ["string"],
            "_id": "string"
          },
          "generationDate": "2024-01-01T00:00:00.000Z",
          "scheduleDate": "2024-01-01T00:00:00.000Z",
          "scheduleTime": "HH:mm",
          "scheduledDateTime": "2024-01-01T00:00:00.000Z"
        }
      ],
      "status": "string",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "createdBy": "string"
    }
  ]
}
```

**Error Responses:**
- `400` - User ID is required
- `500` - An error occurred while retrieving Scheduled Posts

### Create Scheduled Post
**POST** `/api/posts/createscheduledpost/:userId`

Creates a new scheduled post.

**Path Parameters:**
- `userId` (string, required) - User ID

**Request Body:**
```json
{
  "pageId": "string (required)",
  "posts": [
    {
      "generationId": "string (required)",
      "imageUrl": "string (required)",
      "content": {
        "fact": "string (required)",
        "description": "string (required)",
        "highlights": ["string (required)"],
        "_id": "string (required)"
      },
      "generationDate": "2024-01-01T00:00:00.000Z (required)",
      "scheduleDate": "2024-01-01 (required, format: YYYY-MM-DD)",
      "scheduleTime": "HH:mm (required, format: HH:mm)"
    }
  ]
}
```

**Response:**
```json
{
  "message": "Posts scheduled successfully"
}
```

**Error Responses:**
- `400` - At least one post is required or All post fields are required or Invalid generation ID or Invalid schedule date/time format
- `500` - Error scheduling posts

---

## PayPal Integration

### Get PayPal Configuration
**GET** `/api/paypal/config`

Returns PayPal configuration for the frontend.

**Response:**
```json
{
  "success": true,
  "data": {
    "clientId": "string",
    "environment": "string",
    "currency": "USD",
    "intent": "capture"
  }
}
```

**Error Responses:**
- `500` - Failed to get configuration

### Create PayPal Order
**POST** `/api/paypal/orders`

**Authentication:** Required

Creates a new PayPal order.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "cart": {
    "items": [
      {
        "name": "string",
        "quantity": "number",
        "unit_amount": {
          "currency_code": "USD",
          "value": "string"
        }
      }
    ]
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "string",
    "status": "string",
    "links": [
      {
        "href": "string",
        "rel": "string",
        "method": "string"
      }
    ]
  }
}
```

**Error Responses:**
- `401` - User authentication required. Please log in again
- `400` - Cart information is required
- `500` - Failed to create order

### Capture PayPal Order
**POST** `/api/paypal/orders/:orderID/capture`

Captures a PayPal order payment.

**Path Parameters:**
- `orderID` (string, required) - PayPal Order ID

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "string",
    "status": "string",
    "purchase_units": [
      {
        "payments": {
          "captures": [
            {
              "id": "string",
              "status": "string",
              "amount": {
                "currency_code": "USD",
                "value": "string"
              }
            }
          ]
        }
      }
    ]
  }
}
```

**Error Responses:**
- `400` - Order ID is required
- `500` - Failed to capture order

### Get PayPal Order
**GET** `/api/paypal/orders/:orderID`

Retrieves PayPal order details.

**Path Parameters:**
- `orderID` (string, required) - PayPal Order ID

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "string",
    "status": "string",
    "intent": "string",
    "purchase_units": [
      {
        "amount": {
          "currency_code": "USD",
          "value": "string"
        }
      }
    ]
  }
}
```

**Error Responses:**
- `400` - Order ID is required
- `500` - Failed to get order

### Handle PayPal Webhook
**POST** `/api/paypal/webhook`

Handles PayPal webhook notifications.

**Request Body:**
```json
{
  "id": "string",
  "event_type": "string",
  "resource": {
    "id": "string",
    "status": "string"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Webhook processed successfully"
}
```

**Error Responses:**
- `400` - Invalid webhook signature
- `500` - Failed to process webhook

### Get User Payments
**GET** `/api/paypal/payments`

**Authentication:** Required

Retrieves payment history for the authenticated user.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "string",
      "userId": "string",
      "paypalOrderId": "string",
      "paypalPaymentId": "string",
      "amount": "number",
      "currency": "USD",
      "status": "string",
      "paymentMethod": "paypal",
      "description": "PostGen Service Payment",
      "cart": "object",
      "metadata": "object",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ]
}
```

**Error Responses:**
- `401` - User authentication required. Please log in again
- `500` - Failed to get payments

### Get Payment Details
**GET** `/api/paypal/payments/:paymentId`

**Authentication:** Required

Retrieves details for a specific payment.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Path Parameters:**
- `paymentId` (string, required) - Payment ID

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "string",
    "userId": "string",
    "paypalOrderId": "string",
    "paypalPaymentId": "string",
    "amount": "number",
    "currency": "USD",
    "status": "string",
    "paymentMethod": "paypal",
    "description": "PostGen Service Payment",
    "cart": "object",
    "metadata": "object",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

**Error Responses:**
- `401` - User authentication required
- `404` - Payment not found
- `500` - Failed to get payment details

---

## Generation Management

### Get Generations by User
**GET** `/api/generation/getbyuser/:userId`

Retrieves all generations for a user.

**Path Parameters:**
- `userId` (string, required) - User ID

**Response:**
```json
{
  "message": "Generations retrieved successfully.",
  "generations": [
    {
      "_id": "string",
      "content": [
        {
          "fact": "string",
          "description": "string",
          "highlights": ["string"]
        }
      ],
      "images": ["string"],
      "user": "string",
      "generationDate": "2024-01-01T00:00:00.000Z",
      "cost": 0.25,
      "pageName": "string",
      "isVideo": false,
      "pageId": "string",
      "videoUrl": "string",
      "videoType": "string"
    }
  ]
}
```

**Error Responses:**
- `400` - User ID is required
- `500` - An error occurred while retrieving generations

### Remove All Generations
**DELETE** `/api/generation/generate-removeall/:userId`

Removes all generations for a user.

**Path Parameters:**
- `userId` (string, required) - User ID

**Response:**
```json
{
  "message": "Successfully deleted {count} images."
}
```

**Error Responses:**
- `400` - User ID is required
- `404` - No images found for this user
- `500` - Internal server error

---

## Configs Management

### Get Configs
**GET** `/api/configs`

Retrieves current configuration settings.

**Response:**
```json
{
  "_id": "string",
  "templateConfigs": {
    "width": "number",
    "height": "number"
  },
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Error Responses:**
- `404` - Configs not found
- `500` - Failed to fetch configs

### Add Configs
**POST** `/api/configs`

Creates or replaces configuration settings.

**Request Body:**
```json
{
  "width": "number (required, min: 1)",
  "height": "number (required, min: 1)"
}
```

**Response:**
```json
{
  "_id": "string",
  "templateConfigs": {
    "width": "number",
    "height": "number"
  },
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Error Responses:**
- `400` - width and height must be positive numbers
- `500` - Failed to add configs

### Update Configs
**PUT** `/api/configs`

Updates existing configuration settings.

**Request Body:**
```json
{
  "width": "number (optional, min: 1)",
  "height": "number (optional, min: 1)"
}
```

**Response:**
```json
{
  "_id": "string",
  "templateConfigs": {
    "width": "number",
    "height": "number"
  },
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Error Responses:**
- `400` - width/height must be positive numbers when provided
- `404` - Configs not found
- `500` - Failed to update configs

---

## Data Models

### User Model
```json
{
  "username": "string (required, unique)",
  "password": "string (required)",
  "role": "string (required)",
  "accounttype": "string",
  "regdate": "Date (default: now)",
  "accountbalance": "number",
  "availableStorange": "number",
  "usedStorange": "number"
}
```

### Generation Model
```json
{
  "content": [
    {
      "fact": "string (required)",
      "description": "string (required)",
      "highlights": ["string (required)"]
    }
  ],
  "images": ["string"],
  "user": "ObjectId (required, ref: User)",
  "generationDate": "Date (default: now)",
  "cost": "number (required)",
  "pageName": "string (required)",
  "isVideo": "boolean (default: false)",
  "pageId": "ObjectId (required, ref: Page)",
  "videoUrl": "string",
  "videoType": "string"
}
```

### Page Model
```json
{
  "user": "ObjectId (required, ref: User)",
  "pageName": "string (required)",
  "pageUrl": "string (required, unique)",
  "profileImage": "string",
  "coverImage": "string",
  "accessToken": "string (required)"
}
```

### Video Model
```json
{
  "operationIds": ["string (unique)"],
  "videoUrls": ["string"],
  "userId": "ObjectId (ref: User)",
  "numberOfVideos": "number (default: 1)",
  "status": "string",
  "errors": [
    {
      "operationId": "string",
      "message": "string",
      "timestamp": "Date (default: now)"
    }
  ]
}
```

### Payment Model
```json
{
  "userId": "ObjectId (required, ref: User)",
  "paypalOrderId": "string (required, unique)",
  "paypalPaymentId": "string (unique)",
  "amount": "number (required)",
  "currency": "string (default: USD)",
  "status": "string (enum: pending, completed, failed, cancelled)",
  "paymentMethod": "string (default: paypal)",
  "description": "string (default: PostGen Service Payment)",
  "cart": "Mixed (required)",
  "metadata": "Mixed (default: {})",
  "createdAt": "Date (default: now)",
  "updatedAt": "Date (default: now)"
}
```

### GenerationConfig Model
```json
{
  "name": "string (required)",
  "user": "ObjectId (required, ref: User)",
  "pageId": "ObjectId (required, ref: Page)",
  "pageName": "string (required)",
  "mode": "string (required, enum: ['auto', 'manual'])",
  "templateSelectMode": "string (required, enum: ['auto', 'manual'])",
  "templateName": "number (default: 1)",
  "factCount": "number (required, min: 1, max: 25)",
  "numberOfWordsToBeHighlighted": "number (required, min: 1, max: 20)",
  "prompt": "string (required)",
  "colors": {
    "main": "string (required)",
    "child": ["string (required)"]
  },
  "noTextOverlay": "boolean (default: false)",
  "includePageProfileImage": "boolean (default: false)",
  "uploadedData": [
    {
      "rowData": {
        "fact": "string (required)",
        "description": "string (required)"
      }
    }
  ],
  "isActive": "boolean (default: true)",
  "createdAt": "Date (default: now)",
  "updatedAt": "Date (default: now)",
  "model": "string"
}
```

### Posts Model (Scheduled Posts)
```json
{
  "page": "string (required)",
  "posts": [
    {
      "generationId": "ObjectId (required, ref: Generation)",
      "imageUrl": "string (required)",
      "content": {
        "fact": "string (required)",
        "description": "string (required)",
        "highlights": ["string (required)"],
        "_id": "ObjectId (required)"
      },
      "generationDate": "Date (required)",
      "scheduleDate": "Date (required)",
      "scheduleTime": "string (required, format: HH:mm)",
      "scheduledDateTime": "Date (required)"
    }
  ],
  "status": "string (enum: scheduled, published, failed, default: scheduled)",
  "createdAt": "Date (default: now)",
  "createdBy": "ObjectId (required, ref: User)"
}
```

### Configs Model
```json
{
  "templateConfigs": {
    "width": "number (required, min: 1)",
    "height": "number (required, min: 1)"
  },
  "createdAt": "Date (default: now)",
  "updatedAt": "Date (default: now)"
}
```

### Role Model
```json
{
  "name": "string (required, unique)"
}
```

---

## Error Handling

### HTTP Status Codes

- **200** - Success
- **201** - Created
- **400** - Bad Request
- **401** - Unauthorized
- **403** - Forbidden
- **404** - Not Found
- **409** - Conflict (e.g., username already exists)
- **500** - Internal Server Error

### Error Response Format

```json
{
  "message": "Error description",
  "success": false
}
```

### Common Error Messages

- `"Username and password are required."` - Missing credentials
- `"Invalid credentials."` - Wrong username/password
- `"Username already exists."` - Duplicate username
- `"User authentication required. Please log in again."` - Invalid/missing token
- `"Only image files are allowed!"` - Invalid file type
- `"Internal Server Error"` - Server error

---

## Authentication

### JWT Token Usage

Include the JWT token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

### Token Structure

The JWT token contains:
- `userId`: User ID
- `username`: Username
- `role`: User role
- `iat`: Issued at timestamp
- `exp`: Expiration timestamp

---

## Rate Limiting

- Image generation: 5 concurrent operations per user
- Video generation: Subject to service provider limits
- API calls: Standard rate limiting applies

---

## File Upload Limits

- **Image files**: Maximum 5MB
- **Supported formats**: JPEG, PNG, GIF, WebP
- **Video files**: Subject to service provider limits

---

## CORS Configuration

The API supports CORS for the following origins:
- `http://localhost:3000`
- `https://postgen-new.vercel.app`
- `https://www.aipicedit.com`

---

## Environment Variables

Required environment variables:
- `MONGODB_URI` - MongoDB connection string
- `JWT_SECRET` - JWT signing secret
- `RUNWARE_API_KEY` - Runware API key for image generation
- `GEMINI_API_KEY` - Google Gemini API key
- `AWS_ACCESS_KEY_ID` - AWS access key
- `AWS_SECRET_ACCESS_KEY` - AWS secret key
- `AWS_REGION` - AWS region
- `PAYPAL_CLIENT_ID` - PayPal client ID
- `PAYPAL_CLIENT_SECRET` - PayPal client secret

---

## Support

For API support and questions, please contact the development team or refer to the project repository.

