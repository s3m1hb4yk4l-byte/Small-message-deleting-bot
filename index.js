require('dotenv').config();
const { Client, GatewayIntentBits, SlashCommandBuilder, REST, Routes } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const commands = [
    new SlashCommandBuilder()
        .setName('sil')
        .setDescription('Seçilen kriterlere göre toplu mesaj siler.')
        .addStringOption(option =>
            option.setName('tur')
                .setDescription('Silinecek mesaj türünü seç')
                .setRequired(true)
                .addChoices(
                    { name: 'Hepsi', value: 'hepsi' },
                    { name: 'Sadece Metin', value: 'metin' },
                    { name: 'Sadece Resim', value: 'resim' },
                    { name: 'Sadece Video', value: 'video' },
                    { name: 'Sadece GIF', value: 'gif' },
                    { name: 'Sadece Link', value: 'link' },
                    { name: 'Sadece Discord Linki/Daveti', value: 'discord_link' }
                )
        )
        .addIntegerOption(option =>
            option.setName('sayi')
                .setDescription('İşlem yapılacak mesaj sayısı (1-100 arası)')
                .setRequired(true)
                .setMinValue(1)
                .setMaxValue(100)
        )
].map(command => command.toJSON());

client.once('ready', async () => {
    console.log(`[BAŞARILI] Bot giriş yaptı: ${client.user.tag}`);

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        console.log('Komutlar güncelleniyor...');

        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: [] },
        );

        for (const [guildId] of client.guilds.cache) {
            await rest.put(
                Routes.applicationGuildCommands(client.user.id, guildId),
                { body: commands },
            );
        }

        console.log('Slash komutları başarıyla yüklendi!');
    } catch (error) {
        console.error('Komut yükleme hatası:', error);
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'sil') {
        const tur = interaction.options.getString('tur');
        const miktar = interaction.options.getInteger('sayi');

        if (!interaction.member.permissions.has('ManageMessages')) {
            return interaction.reply({ 
                content: '❌ Bu komutu kullanmak için **Mesajları Yönet** yetkisine sahip olmalısın!', 
                ephemeral: true 
            });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            let deletedSize = 0;

            if (tur === 'hepsi') {
                const deleted = await interaction.channel.bulkDelete(miktar, true);
                deletedSize = deleted.size;
            } else {
                // Kanal geçmişindeki son 100 mesajı çekerek üstte kalan resimleri/medyaları da tarıyoruz
                const fetchedMessages = await interaction.channel.messages.fetch({ limit: 100 });
                const messagesArray = Array.from(fetchedMessages.values());
                
                const messagesToDelete = [];

                for (const msg of messagesArray) {
                    if (msg.author.id === client.user.id) continue;
                    // İstediğimiz miktar kadar eşleşme bulduğumuzda döngüyü durduruyoruz
                    if (messagesToDelete.length >= miktar) break;

                    let match = false;
                    const content = msg.content.toLowerCase();
                    const hasAttachment = msg.attachments.size > 0;

                    let isImage = false;
                    let isVideo = false;
                    let isGif = false;

                    if (hasAttachment) {
                        msg.attachments.forEach(att => {
                            const url = (att.url || '').toLowerCase();
                            const name = (att.name || '').toLowerCase();
                            const contentType = (att.contentType || '').toLowerCase();
                            
                            if (contentType.startsWith('image/')) {
                                if (contentType.includes('gif')) {
                                    isGif = true;
                                } else {
                                    isImage = true;
                                }
                            } else if (contentType.startsWith('video/')) {
                                isVideo = true;
                            } else {
                                if (name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.webp') || url.includes('image')) {
                                    isImage = true;
                                }
                                if (name.endsWith('.mp4') || name.endsWith('.mov') || name.endsWith('.webm') || url.includes('video')) {
                                    isVideo = true;
                                }
                                if (name.endsWith('.gif') || url.includes('.gif')) {
                                    isGif = true;
                                }
                            }
                        });
                    }

                    const urlRegex = /(https?:\/\/[^\s]+)/g;
                    const hasLink = urlRegex.test(msg.content);
                    const isDiscordInvite = content.includes('discord.gg/') || content.includes('discord.com/invite/');

                    if (tur === 'metin' && !hasAttachment && !hasLink) {
                        match = true;
                    } else if (tur === 'resim' && isImage) {
                        match = true;
                    } else if (tur === 'video' && isVideo) {
                        match = true;
                    } else if (tur === 'gif' && isGif) {
                        match = true;
                    } else if (tur === 'link' && hasLink && !isDiscordInvite) {
                        match = true;
                    } else if (tur === 'discord_link' && isDiscordInvite) {
                        match = true;
                    }

                    if (match) {
                        messagesToDelete.push(msg);
                    }
                }

                if (messagesToDelete.length === 0) {
                    return interaction.editReply({ 
                        content: '⚠️ Seçilen kritere uygun silinecek mesaj bulunamadı!' 
                    });
                }

                const targetIds = messagesToDelete.map(m => m.id);
                const deleted = await interaction.channel.bulkDelete(targetIds, true);
                deletedSize = deleted.size;
            }
            
            await interaction.editReply({ 
                content: `🧹 Başarıyla **${deletedSize}** adet mesaj silindi! (Tür: **${tur.toUpperCase()}**)` 
            });
        } catch (error) {
            console.error('Mesaj silme hatası:', error);
            await interaction.editReply({ 
                content: '⚠️ Mesajlar silinirken bir hata oluştu. (Not: 14 günden eski mesajlar Discord kısıtlaması nedeniyle toplu silinemez!)' 
            });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);
