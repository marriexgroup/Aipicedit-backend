const { GoogleAuth } = require('google-auth-library');
const fetch = require('node-fetch');

class Veo2Client {
    constructor(serviceAccountKeyPath) {
        this.auth = new GoogleAuth({
            keyFile: serviceAccountKeyPath,
            scopes: ['https://www.googleapis.com/auth/cloud-platform'],
        });
        this.apiBaseUrl = 'https://us-central1-aiplatform.googleapis.com/v1';
        this.timeout = 30000; // 30 seconds
    }

    async generateVideoFromText(textPrompt, options = {}) { 
        if (!textPrompt || typeof textPrompt !== 'string') {
            throw new Error('Valid text prompt is required');
        }

        const endpoint = `${this.apiBaseUrl}/projects/${process.env.GOOGLE_CLOUD_PROJECT}/locations/us-central1/publishers/google/models/${options.parameters.aspectRatio =='16:9'?'veo-3.0-generate-preview':'veo-2.0-generate-001'}:predictLongRunning`;

        const client = await this.auth.getClient();
        const token = (await client.getAccessToken()).token;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    instances: [{ prompt: textPrompt }],
                    parameters: {
                        storageUri: options.storageUri || '',
                        sampleCount: options.sampleCount || 1,
                        ...options.parameters,
                    },
                }),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Veo API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
            }

            return await response.json();
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }

async checkOperationStatus(operationId, modelId = 'veo-3.0-generate-preview') {
    if (!operationId || typeof operationId !== 'string') {
        throw new Error('A valid operation ID is required');
    }

    const operationName = `projects/${process.env.GOOGLE_CLOUD_PROJECT}/locations/us-central1/publishers/google/models/${modelId}/operations/${operationId}`;
    const endpoint = `${this.apiBaseUrl}/projects/${process.env.GOOGLE_CLOUD_PROJECT}/locations/us-central1/publishers/google/models/${modelId}:fetchPredictOperation`;

    const client = await this.auth.getClient();
    const token = (await client.getAccessToken()).token;

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ operationName }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Failed to fetch operation status: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching operation status:', error);
        throw error;
    }
}


}

module.exports = Veo2Client;