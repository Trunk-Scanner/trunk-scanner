const axios = require('axios');

class DiscordWebhook {
    constructor(config) {
        this.webhookUrl = config.discord.webhook.url;
    }

    async sendCallMessage(call) {
        const embed = {
            title: `${call.mode} CALL RECEIVED`,
            description: `**Talkgroup ID:** ${call.talkgroup}\n**Alias:** ${call.talkgroupLabel}\n**System:** ${call.system}\n**Source:** ${call.source}\n**Date/Time:** ${call.dateTime}\n`,
            color: 0x3498db,
            timestamp: new Date().toISOString()
        };

        const data = {
            embeds: [embed]
        };

        try {
            const response = await axios.post(this.webhookUrl, data);
            console.debug('Webhook sent successfully ' + response.data);
        } catch (error) {
            console.error('Error sending webhook:' + error.message);
        }
    }
}

module.exports = DiscordWebhook;