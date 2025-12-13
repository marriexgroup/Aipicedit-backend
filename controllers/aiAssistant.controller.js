const geminiService = require('../services/gemini.service');

exports.chat = async (req, res) => {
    try {
        const { message, history } = req.body;

        if (!message) {
            return res.status(400).json({ message: 'Message is required' });
        }

        const response = await geminiService.chatWithAI(message, history || []);
        res.json({ response });
    } catch (error) {
        console.error('AI Chat Error:', error);
        res.status(500).json({ message: 'Failed to process AI chat request', error: error.message });
    }
};
