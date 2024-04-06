const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, getVoiceConnection } = require('@discordjs/voice');

class DiscordBot {
    constructor(token, channel, systemUrl, whitelist) {
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildVoiceStates,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.MessageContent
            ]
        });
        this.token = token;
        this.voiceChannelId = channel;
        this.systemUrl = systemUrl;
        this.whitelist = whitelist;

        this.player = createAudioPlayer();
        this.queue = [];
        this.isPlaying = false;

        this.client.once('ready', () => {
            console.log('Discord Bot is ready!');
        });

        this.client.login(this.token).then(r =>
            console.log('Logged in to Discord')
        );

        this.client.on('messageCreate', async (message) => {
            if (!message.content.startsWith('&') || message.author.bot) return;

            const args = message.content.slice(1).trim().split(/ +/);
            const command = args.shift().toLowerCase();

            if (command === 'join') {
                if (message.member.voice.channel) {
                    this.joinChannel(message.guild.id, message.member.voice.channel.id);
                    message.reply('Joining your voice channel!');
                } else {
                    message.reply('You need to be in a voice channel!');
                }
            } else if (command === 'leave') {
                this.leaveChannel(message.guild.id);
                message.reply('Leaving the voice channel.');
            }
        });

        this.player.on(AudioPlayerStatus.Idle, () => {
            this.isPlaying = false;
            this.playNextInQueue();
        });
    }

    async joinChannel(guildId, channelId) {
        const connection = joinVoiceChannel({
            channelId: channelId,
            guildId: guildId,
            adapterCreator: this.client.guilds.cache.get(guildId).voiceAdapterCreator,
        });

        await this.sendMessage(this.voiceChannelId);

        connection.subscribe(this.player);

        return connection;
    }

    enqueue(audioUrl, talkgroupId, source) {
        this.queue.push({ audioUrl, talkgroupId, source });
        this.playNextInQueue();
    }

    async playNextInQueue() {
        if (!this.isPlaying && this.queue.length > 0) {
            const { audioUrl, talkgroupId, source } = this.queue.shift();
            console.log('Playing audio for talkgroup:', talkgroupId);

            const resource = createAudioResource(this.systemUrl + audioUrl);
            this.player.play(resource);
            this.isPlaying = true;
            await this.updateNowPlaying(talkgroupId, source);
        }
    }

    setStatus(talkgroupId) {
        this.client.user.setPresence({
            activities: [{ name: `Talkgroup ${talkgroupId}`, type: 'LISTENING' }],
            status: 'online',
        });
    }

    async updateNowPlaying(talkgroupId, source) {
        try {
            const channel = await this.client.channels.fetch(this.voiceChannelId);
            if (!channel) {
                console.error(`Channel with ID ${this.voiceChannelId} not found.`);
                return;
            }

            const message = await channel.messages.fetch(this.editableMessageId);
            if (!message) {
                console.error(`Message with ID ${this.editableMessageId} not found in channel.`);
                return;
            }

            await message.edit(`TGID: ${talkgroupId}\nSource: ${source}`);
            console.log(`Updated now playing to Talkgroup ${talkgroupId}`);
        } catch (error) {
            console.error('Error updating now playing message:', error);
        }
    }

    async sendMessage(channelId) {
        const channel = await this.client.channels.fetch(channelId);
        const message = await channel.send('Initializing talkgroup...');
        this.editableMessageId = message.id;
    }

    async renameVoiceChannel(talkgroupId) {
        try {
            console.log('Renaming voice channel to Talkgroup', talkgroupId)
            const channel = await this.client.channels.fetch(this.voiceChannelId);
            await channel.setName(`Talkgroup ${talkgroupId}`);
            console.log(`Channel renamed to Talkgroup ${talkgroupId}`);
        } catch (error) {
            console.error('Error renaming the voice channel:', error);
        }
    }

    leaveChannel(guildId) {
        const voiceConnection = getVoiceConnection(guildId);
        if (voiceConnection) {
            voiceConnection.destroy();
            console.log('Left the voice channel in guild:', guildId);
        }
    }

    isTalkgroupWhitelisted(talkgroupId) {
        return this.whitelist.some(whitelistItem => whitelistItem.id === talkgroupId);
    }
}

module.exports = DiscordBot;