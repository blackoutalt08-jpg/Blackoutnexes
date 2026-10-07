require('dotenv').config();
const { REST, Routes, SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');

const admin = PermissionFlagsBits.Administrator;

const commands = [
 new SlashCommandBuilder()
  .setName('setup').setDescription('Configure the Blackoutna1 community bot.')
  .setDefaultMemberPermissions(admin)
  .addChannelOption(o=>o.setName('ticket_panel').setDescription('Channel for the ticket panel').addChannelTypes(ChannelType.GuildText).setRequired(true))
  .addChannelOption(o=>o.setName('ticket_category').setDescription('Category where tickets are created').addChannelTypes(ChannelType.GuildCategory).setRequired(true))
  .addChannelOption(o=>o.setName('roles_channel').setDescription('Channel for button roles').addChannelTypes(ChannelType.GuildText).setRequired(true))
  .addChannelOption(o=>o.setName('rules_channel').setDescription('Channel for the server rules').addChannelTypes(ChannelType.GuildText).setRequired(true))
  .addChannelOption(o=>o.setName('welcome_channel').setDescription('Channel for member welcomes').addChannelTypes(ChannelType.GuildText).setRequired(true))
  .addChannelOption(o=>o.setName('announcement_channel').setDescription('Default announcement channel').addChannelTypes(ChannelType.GuildText).setRequired(true))
  .addChannelOption(o=>o.setName('youtube_channel').setDescription('Channel for new YouTube videos').addChannelTypes(ChannelType.GuildText).setRequired(true))
  .addChannelOption(o=>o.setName('stream_channel').setDescription('Channel for live stream notifications').addChannelTypes(ChannelType.GuildText).setRequired(true))
  .addRoleOption(o=>o.setName('staff_role').setDescription('Staff role that can access tickets').setRequired(true))
  .addRoleOption(o=>o.setName('youtube_role').setDescription('Role pinged for new videos').setRequired(true))
  .addRoleOption(o=>o.setName('stream_role').setDescription('Role pinged for streams').setRequired(true))
  .addRoleOption(o=>o.setName('tiktok_role').setDescription('Optional TikTok notification role')),
 new SlashCommandBuilder()
  .setName('configure').setDescription('Edit bot sections directly from Discord.')
  .setDefaultMemberPermissions(admin)
  .addSubcommand(sc=>sc.setName('tickets').setDescription('Configure the ticket system.')
    .addChannelOption(o=>o.setName('panel_channel').setDescription('Channel for the ticket panel'))
    .addChannelOption(o=>o.setName('category').setDescription('Category where tickets are created'))
    .addRoleOption(o=>o.setName('staff_role').setDescription('Role that can access tickets')))
  .addSubcommand(sc=>sc.setName('welcome').setDescription('Configure welcome messages and automatic join roles.')
    .addChannelOption(o=>o.setName('channel').setDescription('Welcome channel').addChannelTypes(ChannelType.GuildText,ChannelType.GuildAnnouncement))
    .addStringOption(o=>o.setName('message').setDescription('Welcome text; supports {user} and {server}').setMaxLength(1800))
    .addRoleOption(o=>o.setName('role_1').setDescription('First role automatically given on join'))
    .addRoleOption(o=>o.setName('role_2').setDescription('Second automatic join role'))
    .addRoleOption(o=>o.setName('role_3').setDescription('Third automatic join role'))
    .addBooleanOption(o=>o.setName('clear_roles').setDescription('Remove all configured automatic join roles')))
  .addSubcommand(sc=>sc.setName('rules').setDescription('Set the rules channel.')
    .addChannelOption(o=>o.setName('channel').setDescription('Rules channel').setRequired(true)))
  .addSubcommand(sc=>sc.setName('announcements').setDescription('Set the default announcement channel.')
    .addChannelOption(o=>o.setName('channel').setDescription('Announcement or text channel').addChannelTypes(ChannelType.GuildText,ChannelType.GuildAnnouncement).setRequired(true)))
  .addSubcommand(sc=>sc.setName('youtube').setDescription('Configure YouTube notifications.')
    .addChannelOption(o=>o.setName('channel').setDescription('YouTube notification channel'))
    .addRoleOption(o=>o.setName('ping_role').setDescription('Role to ping for YouTube uploads')))
  .addSubcommand(sc=>sc.setName('streams').setDescription('Configure live-stream notifications.')
    .addChannelOption(o=>o.setName('channel').setDescription('Live notification channel'))
    .addRoleOption(o=>o.setName('ping_role').setDescription('Role to ping when live')))
  .addSubcommand(sc=>sc.setName('roles').setDescription('Set the reaction-role panel channel.')
    .addChannelOption(o=>o.setName('channel').setDescription('Reaction-role channel').setRequired(true)))
  .addSubcommand(sc=>sc.setName('view').setDescription('View the current configuration')),
 new SlashCommandBuilder()
  .setName('reaction-role').setDescription('Manage self-assignable button roles from Discord.')
  .setDefaultMemberPermissions(admin)
  .addSubcommand(sc=>sc.setName('add').setDescription('Add a role button.')
    .addRoleOption(o=>o.setName('role').setDescription('Discord role to assign').setRequired(true))
    .addStringOption(o=>o.setName('label').setDescription('Button label').setRequired(true).setMaxLength(80))
    .addStringOption(o=>o.setName('emoji').setDescription('Optional Unicode emoji'))
    .addStringOption(o=>o.setName('style').setDescription('Button color/style').addChoices(
      {name:'Blue',value:'Primary'},{name:'Gray',value:'Secondary'},{name:'Green',value:'Success'},{name:'Red',value:'Danger'}
    )))
  .addSubcommand(sc=>sc.setName('delete').setDescription('Delete a role button.')
    .addRoleOption(o=>o.setName('role').setDescription('Role to remove from the panel').setRequired(true)))
  .addSubcommand(sc=>sc.setName('edit').setDescription('Edit an existing role button.')
    .addRoleOption(o=>o.setName('role').setDescription('Existing configured role').setRequired(true))
    .addStringOption(o=>o.setName('label').setDescription('New button label').setMaxLength(80))
    .addStringOption(o=>o.setName('emoji').setDescription('New Unicode emoji; use NONE to remove it'))
    .addStringOption(o=>o.setName('style').setDescription('New button color/style').addChoices(
      {name:'Blue',value:'Primary'},{name:'Gray',value:'Secondary'},{name:'Green',value:'Success'},{name:'Red',value:'Danger'}
    )))
  .addSubcommand(sc=>sc.setName('list').setDescription('List configured role buttons'))
  .addSubcommand(sc=>sc.setName('refresh').setDescription('Post a fresh role panel')),
 new SlashCommandBuilder()
  .setName('announcement').setDescription('Send a professional embedded announcement.')
  .setDefaultMemberPermissions(admin)
  .addStringOption(o=>o.setName('title').setDescription('Announcement title').setRequired(true))
  .addStringOption(o=>o.setName('message').setDescription('Announcement message').setRequired(true))
  .addChannelOption(o=>o.setName('channel').setDescription('Where to send it').addChannelTypes(ChannelType.GuildText))
  .addRoleOption(o=>o.setName('ping_role').setDescription('Optional role to ping')),
 new SlashCommandBuilder()
  .setName('welcome-message').setDescription('Change the automatic welcome message.')
  .setDefaultMemberPermissions(admin)
  .addStringOption(o=>o.setName('message').setDescription('Use {user} for the new member mention and {server} for server name.').setRequired(true)),
 new SlashCommandBuilder()
  .setName('settings').setDescription('Show the current bot configuration.')
  .setDefaultMemberPermissions(admin),
 new SlashCommandBuilder()
  .setName('post-panels').setDescription('Repost the ticket, role, and rules panels.')
  .setDefaultMemberPermissions(admin),
 new SlashCommandBuilder()
  .setName('video').setDescription('Post a new video link and ping the configured YouTube role.')
  .setDefaultMemberPermissions(admin)
  .addStringOption(o=>o.setName('url').setDescription('YouTube video URL').setRequired(true))
  .addStringOption(o=>o.setName('title').setDescription('Video title')),
 new SlashCommandBuilder()
  .setName('stream').setDescription('Post a live stream link and ping the configured stream role.')
  .setDefaultMemberPermissions(admin)
  .addStringOption(o=>o.setName('url').setDescription('Stream URL').setRequired(true))
  .addStringOption(o=>o.setName('title').setDescription('Stream title'))
].map(c=>c.toJSON());

(async()=>{
 if(!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID || !process.env.GUILD_ID) throw new Error('Fill in DISCORD_TOKEN, CLIENT_ID, and GUILD_ID in .env first.');
 const rest = new REST({version:'10'}).setToken(process.env.DISCORD_TOKEN);
 await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), {body:commands});
 console.log('All Blackoutna1 commands registered successfully.');
})().catch(e=>{console.error(e);process.exit(1)});
