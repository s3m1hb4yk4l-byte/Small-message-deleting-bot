require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once('ready', () => {
    console.log(`[BAŞARILI] Bot giriş yaptı: ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // Örnek kullanım: /sil 10
    if (message.content.startsWith('/sil')) {
        const args = message.content.split(' ');
        const miktar = parseInt(args[1]);

        // Sayı girilmemişse veya geçerli bir sayı değilse
        if (isNaN(miktar) || miktar <= 0) {
            return message.reply('Lütfen silinecek mesaj sayısını belirt! Örnek: `/sil 10`');
        }

        // Discord API tek seferde en fazla 100 mesaj silmeye izin verir
        if (miktar > 100) {
            return message.reply('Tek seferde en fazla 100 mesaj silebilirsin!');
        }

        try {
            // /sil komutunun kendisini de silmek için miktara +1 ekleyip siliyoruz
            await message.channel.bulkDelete(miktar + 1, true);
            
            const bilgiMesaji = await message.channel.send(`🧹 **${miktar}** adet mesaj başarıyla silindi!`);
            
            // Bilgi mesajını 3 saniye sonra otomatik siler
            setTimeout(() => bilgiMesaji.delete().catch(() => {}), 3000);
        } catch (error) {
            console.error('Mesaj silme hatası:', error);
            message.channel.send('Mesajlar silinirken bir hata oluştu. (Not: 14 günden eski mesajlar Discord kısıtlaması nedeniyle toplu silinemez!)');
        }
    }
});

client.login(process.env.DISCORD_TOKEN);