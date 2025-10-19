const GenerationConfig = require('../models/generationConfig.model');
const User = require('../models/user.model');

// Save a new generation configuration
async function saveGenerationConfig(req, res) {
    try {
        const {
            name,
            userId,
            pageId,
            pageName,
            mode,
            templateSelectMode,
            templateName,
            factCount,
            numberOfWordsToBeHighlighted,
            prompt,
            colors,
            noTextOverlay,
            includePageProfileImage,
            uploadedData,
            model
        } = req.body;

        // Validate required fields
        if (!name || !userId || !pageId || !pageName || !mode || !templateSelectMode || !factCount || !numberOfWordsToBeHighlighted || !prompt || !colors || !model) {
            return res.status(400).json({ error: "Missing required fields." });
        }

        // Check if user exists
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: "User not found." });
        }

        // Check if configuration name already exists for this user
        const existingConfig = await GenerationConfig.findOne({
            user: userId,
            name: name,
            isActive: true
        });

        if (existingConfig) {
            return res.status(409).json({ error: "A configuration with this name already exists." });
        }

        // Create new configuration
        const newConfig = new GenerationConfig({
            name,
            user: userId,
            pageId,
            pageName,
            mode,
            templateSelectMode,
            templateName,
            factCount,
            numberOfWordsToBeHighlighted,
            prompt,
            colors,
            noTextOverlay,
            includePageProfileImage,
            uploadedData: uploadedData || [],
            model
        });

        await newConfig.save();

        res.status(201).json({
            success: true,
            message: "Generation configuration saved successfully.",
            config: newConfig
        });

    } catch (error) {
        console.error('Error saving generation config:', error);
        res.status(500).json({ error: "Internal server error." });
    }
}

// Get all configurations for a user
async function getUserConfigurations(req, res) {
    try {
        const { userId } = req.params;

        if (!userId) {
            return res.status(400).json({ error: "User ID is required." });
        }

        const configurations = await GenerationConfig.find({
            user: userId,
            isActive: true
        }).sort({ updatedAt: -1 });

        res.status(200).json({
            success: true,
            configurations
        });

    } catch (error) {
        console.error('Error fetching user configurations:', error);
        res.status(500).json({ error: "Internal server error." });
    }
}

// Get a specific configuration by ID
async function getConfigurationById(req, res) {
    try {
        const { configId } = req.params;
        const { userId } = req.query;

        if (!configId || !userId) {
            return res.status(400).json({ error: "Configuration ID and User ID are required." });
        }

        const configuration = await GenerationConfig.findOne({
            _id: configId,
            user: userId,
            isActive: true
        });

        if (!configuration) {
            return res.status(404).json({ error: "Configuration not found." });
        }

        res.status(200).json({
            success: true,
            configuration
        });

    } catch (error) {
        console.error('Error fetching configuration:', error);
        res.status(500).json({ error: "Internal server error." });
    }
}

// Update a configuration
async function updateConfiguration(req, res) {
    try {
        const { configId } = req.params;
        const {
            name,
            userId,
            pageId,
            pageName,
            mode,
            templateSelectMode,
            templateName,
            factCount,
            numberOfWordsToBeHighlighted,
            prompt,
            colors,
            noTextOverlay,
            includePageProfileImage,
            uploadedData,
            model
        } = req.body;

        if (!configId || !userId) {
            return res.status(400).json({ error: "Configuration ID and User ID are required." });
        }

        // Check if configuration exists and belongs to user
        const existingConfig = await GenerationConfig.findOne({
            _id: configId,
            user: userId,
            isActive: true
        });

        if (!existingConfig) {
            return res.status(404).json({ error: "Configuration not found." });
        }

        // Check if new name conflicts with other configurations
        if (name && name !== existingConfig.name) {
            const nameConflict = await GenerationConfig.findOne({
                user: userId,
                name: name,
                _id: { $ne: configId },
                isActive: true
            });

            if (nameConflict) {
                return res.status(409).json({ error: "A configuration with this name already exists." });
            }
        }

        // Update configuration
        const updateData = {
            name: name || existingConfig.name,
            pageId: pageId || existingConfig.pageId,
            pageName: pageName || existingConfig.pageName,
            mode: mode || existingConfig.mode,
            templateSelectMode: templateSelectMode || existingConfig.templateSelectMode,
            templateName: templateName || existingConfig.templateName,
            factCount: factCount || existingConfig.factCount,
            numberOfWordsToBeHighlighted: numberOfWordsToBeHighlighted || existingConfig.numberOfWordsToBeHighlighted,
            prompt: prompt || existingConfig.prompt,
            colors: colors || existingConfig.colors,
            noTextOverlay: noTextOverlay !== undefined ? noTextOverlay : existingConfig.noTextOverlay,
            includePageProfileImage: includePageProfileImage !== undefined ? includePageProfileImage : existingConfig.includePageProfileImage,
            uploadedData: uploadedData || existingConfig.uploadedData,
            model: model || existingConfig.model,
            updatedAt: Date.now()
        };

        const updatedConfig = await GenerationConfig.findByIdAndUpdate(
            configId,
            updateData,
            { new: true }
        );

        res.status(200).json({
            success: true,
            message: "Configuration updated successfully.",
            configuration: updatedConfig
        });

    } catch (error) {
        console.error('Error updating configuration:', error);
        res.status(500).json({ error: "Internal server error." });
    }
}

// Delete a configuration (soft delete)
async function deleteConfiguration(req, res) {
    try {
        const { configId } = req.params;
        const { userId } = req.query;

        if (!configId || !userId) {
            return res.status(400).json({ error: "Configuration ID and User ID are required." });
        }

        const configuration = await GenerationConfig.findOne({
            _id: configId,
            user: userId,
            isActive: true
        });

        if (!configuration) {
            return res.status(404).json({ error: "Configuration not found." });
        }

        // Soft delete by setting isActive to false
        await GenerationConfig.findByIdAndUpdate(configId, {
            isActive: false,
            updatedAt: Date.now()
        });

        res.status(200).json({
            success: true,
            message: "Configuration deleted successfully."
        });

    } catch (error) {
        console.error('Error deleting configuration:', error);
        res.status(500).json({ error: "Internal server error." });
    }
}

module.exports = {
    saveGenerationConfig,
    getUserConfigurations,
    getConfigurationById,
    updateConfiguration,
    deleteConfiguration
};
