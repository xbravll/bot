// ================================================
// DISCORD KEY + HWID MANAGER (GITHUB GIST VERSION)
// ================================================
// Install: npm install discord.js node-fetch

const { Client, GatewayIntentBits, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fetch = require('node-fetch');

// ================================================
// KONFIGURASI
// ================================================
const config = {
    TOKEN: 'YOUR_DISCORD_BOT_TOKEN',
    
    // GitHub Configuration
    GITHUB_TOKEN: 'Y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', // Personal Access Token dari GitHub
    KEYS_GIST_ID: 'aa73df79dfa4d7fdc5811a2c1af71722', // ID dari gist keys database
    HWID_GIST_ID: '808bd8a19c1a6eaa895ddfb4ed84f610', // ID dari gist HWID database
    
    ADMIN_ROLE_ID: '1434546813884698624',
    PREFIX: '!'
};

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// ================================================
// GITHUB GIST FUNCTIONS
// ================================================

async function fetchGist(gistId, fileName = 'database.json') {
    try {
        const response = await fetch(`https://api.github.com/gists/${gistId}`, {
            headers: {
                'Authorization': `token ${config.GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });
        
        const gist = await response.json();
        const fileContent = gist.files[fileName].content;
        return JSON.parse(fileContent);
    } catch (error) {
        console.error('Error fetching gist:', error);
        return null;
    }
}

async function updateGist(gistId, data, fileName = 'database.json') {
    try {
        const response = await fetch(`https://api.github.com/gists/${gistId}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `token ${config.GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                files: {
                    [fileName]: {
                        content: JSON.stringify(data, null, 2)
                    }
                }
            })
        });
        
        return response.ok;
    } catch (error) {
        console.error('Error updating gist:', error);
        return false;
    }
}

async function fetchKeys() {
    const data = await fetchGist(config.KEYS_GIST_ID, 'keys.json');
    return data || { keys: {} };
}

async function fetchHWID() {
    const data = await fetchGist(config.HWID_GIST_ID, 'hwid.json');
    return data || {};
}

async function updateKeys(data) {
    return await updateGist(config.KEYS_GIST_ID, data, 'keys.json');
}

async function updateHWID(data) {
    return await updateGist(config.HWID_GIST_ID, data, 'hwid.json');
}

// ================================================
// HELPER FUNCTIONS
// ================================================

function generateKey(length = 16) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let key = '';
    for (let i = 0; i < length; i++) {
        key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
}

function formatDate(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function isAdmin(member) {
    return member.roles.cache.has(config.ADMIN_ROLE_ID) || 
           member.permissions.has(PermissionFlagsBits.Administrator);
}

// ================================================
// KEY COMMANDS
// ================================================

async function addKeyCommand(message, args) {
    if (!isAdmin(message.member)) {
        return message.reply('❌ Tidak ada permission!');
    }

    const days = parseInt(args[0]);
    let slots = args[1];
    
    const isUnlimited = slots === '0' || slots?.toLowerCase() === 'unlimited' || slots?.toLowerCase() === 'inf';
    slots = isUnlimited ? 0 : parseInt(slots);
    
    if (!days || days < 1 || (slots < 0 && !isUnlimited)) {
        return message.reply('❌ Format salah!\nGunakan: `!addkey <days> <slots> [custom_key]`\nContoh: `!addkey 30 3` atau `!addkey 30 unlimited VIPKEY`');
    }

    const customKey = args[2] ? args[2].toUpperCase() : generateKey();
    const expDate = new Date();
    expDate.setDate(expDate.getDate() + days);
    const expDateStr = formatDate(expDate);

    const keysData = await fetchKeys();
    if (keysData.keys[customKey]) {
        return message.reply(`❌ Key \`${customKey}\` sudah ada!`);
    }
    keysData.keys[customKey] = expDateStr;
    
    const hwidData = await fetchHWID();
    hwidData[customKey] = {
        maxSlots: slots,
        hwids: []
    };
    
    const keySuccess = await updateKeys(keysData);
    const hwidSuccess = await updateHWID(hwidData);
    
    if (keySuccess && hwidSuccess) {
        const slotsText = slots === 0 ? '♾️ Unlimited' : `${slots} device`;
        
        const embed = new EmbedBuilder()
            .setColor(slots === 0 ? 0xFFD700 : 0x00FF00)
            .setTitle(slots === 0 ? '✨ Unlimited Key Created' : '✅ Key Berhasil Ditambahkan')
            .addFields(
                { name: '🔑 Key', value: `\`${customKey}\``, inline: false },
                { name: '📅 Duration', value: `${days} hari`, inline: true },
                { name: '👥 Max Slots', value: slotsText, inline: true },
                { name: '📅 Expire', value: expDateStr, inline: false }
            )
            .setFooter({ text: `Created by ${message.author.tag}` })
            .setTimestamp();
        
        message.reply({ embeds: [embed] });
    } else {
        message.reply('❌ Gagal update database!');
    }
}

async function removeKeyCommand(message, args) {
    if (!isAdmin(message.member)) {
        return message.reply('❌ Tidak ada permission!');
    }

    const key = args[0]?.toUpperCase();
    if (!key) {
        return message.reply('❌ Format salah! Gunakan: `!removekey <key>`');
    }

    const keysData = await fetchKeys();
    const hwidData = await fetchHWID();
    
    if (!keysData.keys[key]) {
        return message.reply(`❌ Key \`${key}\` tidak ditemukan!`);
    }

    delete keysData.keys[key];
    delete hwidData[key];
    
    const keySuccess = await updateKeys(keysData);
    const hwidSuccess = await updateHWID(hwidData);
    
    if (keySuccess && hwidSuccess) {
        const embed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('🗑️ Key Berhasil Dihapus')
            .addFields(
                { name: '🔑 Key', value: `\`${key}\``, inline: true }
            )
            .setFooter({ text: `Deleted by ${message.author.tag}` })
            .setTimestamp();
        
        message.reply({ embeds: [embed] });
    } else {
        message.reply('❌ Gagal update database!');
    }
}

async function keyInfoCommand(message, args) {
    if (!isAdmin(message.member)) {
        return message.reply('❌ Tidak ada permission!');
    }

    const key = args[0]?.toUpperCase();
    if (!key) {
        return message.reply('❌ Format salah! Gunakan: `!keyinfo <key>`');
    }

    const keysData = await fetchKeys();
    const hwidData = await fetchHWID();
    
    if (!keysData.keys[key]) {
        return message.reply(`❌ Key \`${key}\` tidak valid!`);
    }

    const expDate = keysData.keys[key];
    const exp = new Date(expDate);
    const now = new Date();
    const isExpired = exp < now;
    const daysLeft = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
    
    const keyHWID = hwidData[key] || { maxSlots: 0, hwids: [] };
    const usedSlots = keyHWID.hwids.length;
    const maxSlots = keyHWID.maxSlots;
    const isUnlimited = maxSlots === 0 || maxSlots === -1;
    
    const hwidList = keyHWID.hwids.length > 0 
        ? keyHWID.hwids.map((h, i) => `${i + 1}. \`${h.substring(0, 16)}...\``).join('\n')
        : 'Belum ada HWID terdaftar';

    const slotsDisplay = isUnlimited ? '♾️ Unlimited' : `${usedSlots}/${maxSlots} terpakai`;
    const availDisplay = isUnlimited ? '♾️ Unlimited' : (usedSlots >= maxSlots ? '❌ Full' : `✅ ${maxSlots - usedSlots} slot tersedia`);

    const embed = new EmbedBuilder()
        .setColor(isExpired ? 0xFF0000 : (isUnlimited ? 0xFFD700 : 0x00FF00))
        .setTitle(isUnlimited ? '✨ Unlimited Key Info' : '🔍 Key Information')
        .addFields(
            { name: '🔑 Key', value: `\`${key}\``, inline: true },
            { name: '📅 Expire', value: expDate, inline: true },
            { name: '⏱️ Status', value: isExpired ? '❌ Expired' : `✅ ${daysLeft} hari lagi`, inline: true },
            { name: '👥 Slots', value: slotsDisplay, inline: true },
            { name: '📊 Availability', value: availDisplay, inline: true },
            { name: '\u200B', value: '\u200B', inline: true },
            { name: '🔐 Registered HWIDs', value: hwidList, inline: false }
        )
        .setTimestamp();

    message.reply({ embeds: [embed] });
}

async function resetKeyCommand(message, args) {
    if (!isAdmin(message.member)) {
        return message.reply('❌ Tidak ada permission!');
    }

    const key = args[0]?.toUpperCase();
    if (!key) {
        return message.reply('❌ Format salah! Gunakan: `!resetkey <key>`');
    }

    const hwidData = await fetchHWID();
    
    if (!hwidData[key]) {
        return message.reply(`❌ Key \`${key}\` tidak ditemukan!`);
    }

    const oldCount = hwidData[key].hwids.length;
    hwidData[key].hwids = [];
    
    const success = await updateHWID(hwidData);
    
    if (success) {
        const embed = new EmbedBuilder()
            .setColor(0xFFA500)
            .setTitle('🔄 Key Reset')
            .setDescription(`Semua HWID dari key \`${key}\` telah dihapus`)
            .addFields(
                { name: '🔑 Key', value: `\`${key}\``, inline: true },
                { name: '🗑️ Removed', value: `${oldCount} HWID`, inline: true }
            )
            .setFooter({ text: `Reset by ${message.author.tag}` })
            .setTimestamp();
        
        message.reply({ embeds: [embed] });
    } else {
        message.reply('❌ Gagal reset key!');
    }
}

async function setSlotsCommand(message, args) {
    if (!isAdmin(message.member)) {
        return message.reply('❌ Tidak ada permission!');
    }

    const key = args[0]?.toUpperCase();
    let newSlots = args[1];
    
    const isUnlimited = newSlots === '0' || newSlots?.toLowerCase() === 'unlimited' || newSlots?.toLowerCase() === 'inf';
    newSlots = isUnlimited ? 0 : parseInt(newSlots);
    
    if (!key || (newSlots < 0 && !isUnlimited)) {
        return message.reply('❌ Format salah! Gunakan: `!setslots <key> <new_slots>`');
    }

    const hwidData = await fetchHWID();
    
    if (!hwidData[key]) {
        return message.reply(`❌ Key \`${key}\` tidak ditemukan!`);
    }

    const oldSlots = hwidData[key].maxSlots;
    const oldIsUnlimited = oldSlots === 0 || oldSlots === -1;
    hwidData[key].maxSlots = newSlots;
    
    const success = await updateHWID(hwidData);
    
    if (success) {
        const oldText = oldIsUnlimited ? '♾️ Unlimited' : `${oldSlots}`;
        const newText = isUnlimited ? '♾️ Unlimited' : `${newSlots}`;
        
        const embed = new EmbedBuilder()
            .setColor(isUnlimited ? 0xFFD700 : 0x3498DB)
            .setTitle(isUnlimited ? '✨ Key Set to Unlimited' : '⚙️ Slots Updated')
            .addFields(
                { name: '🔑 Key', value: `\`${key}\``, inline: true },
                { name: '📊 Old Slots', value: oldText, inline: true },
                { name: '📊 New Slots', value: newText, inline: true }
            )
            .setFooter({ text: `Updated by ${message.author.tag}` })
            .setTimestamp();
        
        message.reply({ embeds: [embed] });
    } else {
        message.reply('❌ Gagal update slots!');
    }
}

async function listKeysCommand(message) {
    if (!isAdmin(message.member)) {
        return message.reply('❌ Tidak ada permission!');
    }

    const keysData = await fetchKeys();
    const hwidData = await fetchHWID();
    const keys = Object.entries(keysData.keys);
    
    if (keys.length === 0) {
        return message.reply('📋 Tidak ada key.');
    }

    const now = new Date();
    let activeKeys = [];
    let unlimitedKeys = [];

    keys.forEach(([key, expDate]) => {
        const exp = new Date(expDate);
        const hwid = hwidData[key] || { maxSlots: 0, hwids: [] };
        const isUnlimited = hwid.maxSlots === 0 || hwid.maxSlots === -1;
        const slots = isUnlimited ? '♾️' : `${hwid.hwids.length}/${hwid.maxSlots}`;
        
        if (exp > now) {
            const keyInfo = `\`${key}\` - Exp: ${expDate} - Slots: ${slots}`;
            if (isUnlimited) {
                unlimitedKeys.push(keyInfo);
            } else {
                activeKeys.push(keyInfo);
            }
        }
    });

    const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle('📋 Active Keys')
        .setFooter({ text: `Total: ${activeKeys.length + unlimitedKeys.length} keys` })
        .setTimestamp();

    if (unlimitedKeys.length > 0) {
        embed.addFields({ 
            name: `✨ Unlimited Keys (${unlimitedKeys.length})`, 
            value: unlimitedKeys.slice(0, 5).join('\n') + (unlimitedKeys.length > 5 ? `\n... +${unlimitedKeys.length - 5} more` : ''),
            inline: false 
        });
    }

    if (activeKeys.length > 0) {
        embed.addFields({ 
            name: `🔑 Limited Keys (${activeKeys.length})`, 
            value: activeKeys.slice(0, 10).join('\n') + (activeKeys.length > 10 ? `\n... +${activeKeys.length - 10} more` : ''),
            inline: false 
        });
    }

    if (activeKeys.length === 0 && unlimitedKeys.length === 0) {
        embed.setDescription('Tidak ada active keys');
    }

    message.reply({ embeds: [embed] });
}

// Quick templates
async function quickKeyCommand(message, type) {
    if (!isAdmin(message.member)) {
        return message.reply('❌ Tidak ada permission!');
    }

    const templates = {
        trial: { days: 1, slots: 1, name: 'TRIAL' },
        weekly: { days: 7, slots: 3, name: 'WEEKLY' },
        monthly: { days: 30, slots: 5, name: 'MONTHLY' },
        lifetime: { days: 9999, slots: 0, name: 'LIFE' },
        vip: { days: 365, slots: 0, name: 'VIP' }
    };

    const template = templates[type];
    if (!template) return;

    const customKey = generateKey(8) + '_' + template.name;
    const expDate = new Date();
    expDate.setDate(expDate.getDate() + template.days);
    const expDateStr = formatDate(expDate);

    const keysData = await fetchKeys();
    keysData.keys[customKey] = expDateStr;
    
    const hwidData = await fetchHWID();
    hwidData[customKey] = {
        maxSlots: template.slots,
        hwids: []
    };
    
    const keySuccess = await updateKeys(keysData);
    const hwidSuccess = await updateHWID(hwidData);
    
    if (keySuccess && hwidSuccess) {
        const slotsText = template.slots === 0 ? '♾️ Unlimited' : `${template.slots} device`;
        const isUnlimited = template.slots === 0;
        
        const embed = new EmbedBuilder()
            .setColor(isUnlimited ? 0xFFD700 : 0x00FF00)
            .setTitle(`⚡ ${template.name} Key Created`)
            .addFields(
                { name: '🔑 Key', value: `\`${customKey}\``, inline: false },
                { name: '📅 Duration', value: `${template.days} hari`, inline: true },
                { name: '👥 Slots', value: slotsText, inline: true },
                { name: '📅 Expire', value: expDateStr, inline: false }
            )
            .setFooter({ text: `Created by ${message.author.tag}` })
            .setTimestamp();
        
        message.reply({ embeds: [embed] });
    } else {
        message.reply('❌ Gagal membuat key!');
    }
}

function helpCommand(message) {
    const embed = new EmbedBuilder()
        .setColor(0x3498DB)
        .setTitle('📖 Key Manager Commands')
        .setDescription('**Key Management:**')
        .addFields(
            { name: '!addkey <days> <slots> [key]', value: 'Tambah key custom\nEx: `!addkey 30 3` atau `!addkey 7 unlimited`', inline: false },
            { name: '!removekey <key>', value: 'Hapus key', inline: false },
            { name: '!keyinfo <key>', value: 'Info detail key + HWID', inline: false },
            { name: '!listkeys', value: 'List semua keys', inline: false },
            { name: '\u200B', value: '**Quick Templates:**', inline: false },
            { name: '!trial', value: '1 hari, 1 device', inline: true },
            { name: '!weekly', value: '7 hari, 3 devices', inline: true },
            { name: '!monthly', value: '30 hari, 5 devices', inline: true },
            { name: '!lifetime', value: '9999 hari, unlimited', inline: true },
            { name: '!vip', value: '365 hari, unlimited', inline: true },
            { name: '\u200B', value: '\u200B', inline: true },
            { name: '\u200B', value: '**HWID Management:**', inline: false },
            { name: '!resetkey <key>', value: 'Reset semua HWID dari key', inline: false },
            { name: '!setslots <key> <slots>', value: 'Ubah max slots', inline: false }
        )
        .setFooter({ text: 'Powered by GitHub Gist' })
        .setTimestamp();

    message.reply({ embeds: [embed] });
}

// ================================================
// BOT EVENTS
// ================================================

client.on('ready', () => {
    console.log(`✅ Bot logged in as ${client.user.tag}`);
    client.user.setActivity('!help | Key Manager');
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith(config.PREFIX)) return;

    const args = message.content.slice(config.PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    try {
        switch (command) {
            case 'addkey':
                await addKeyCommand(message, args);
                break;
            case 'removekey':
                await removeKeyCommand(message, args);
                break;
            case 'keyinfo':
                await keyInfoCommand(message, args);
                break;
            case 'resetkey':
                await resetKeyCommand(message, args);
                break;
            case 'setslots':
                await setSlotsCommand(message, args);
                break;
            case 'listkeys':
                await listKeysCommand(message);
                break;
            case 'trial':
                await quickKeyCommand(message, 'trial');
                break;
            case 'weekly':
                await quickKeyCommand(message, 'weekly');
                break;
            case 'monthly':
                await quickKeyCommand(message, 'monthly');
                break;
            case 'lifetime':
                await quickKeyCommand(message, 'lifetime');
                break;
            case 'vip':
                await quickKeyCommand(message, 'vip');
                break;
            case 'help':
                helpCommand(message);
                break;
        }
    } catch (error) {
        console.error('Command error:', error);
        message.reply('❌ Error saat menjalankan command!');
    }
});

client.login(config.TOKEN);
