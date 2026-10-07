require('dotenv').config();
const fs = require('fs');
const path = require('path');
const Parser = require('rss-parser');
const {
 Client, GatewayIntentBits, PermissionFlagsBits, ChannelType, EmbedBuilder,
 ActionRowBuilder, ButtonBuilder, ButtonStyle
} = require('discord.js');

const client = new Client({ intents:[GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
const parser = new Parser();
const DATA = path.join(__dirname,'config.json');
const REACTION_ROLES_FILE = path.join(__dirname,'reaction-roles.json');

function loadReactionRoles(){
 try{
  const raw=JSON.parse(fs.readFileSync(REACTION_ROLES_FILE,'utf8'));
  return (raw.roles||[]).filter(r=>r.enabled!==false && r.id && r.role_name && r.label);
 }catch(e){
  console.error('Could not read reaction-roles.json:',e.message);
  return [];
 }
}
function loadReactionRoleFile(){
 try{return JSON.parse(fs.readFileSync(REACTION_ROLES_FILE,'utf8'))}
 catch{return {roles:[]}}
}
function saveReactionRoleFile(data){
 fs.writeFileSync(REACTION_ROLES_FILE,JSON.stringify(data,null,2),'utf8');
}
function roleKey(roleId){ return `role_${roleId}`; }

function buttonStyle(name){
 const styles={Primary:ButtonStyle.Primary,Secondary:ButtonStyle.Secondary,Success:ButtonStyle.Success,Danger:ButtonStyle.Danger};
 return styles[name]||ButtonStyle.Secondary;
}

function load(){ try{return JSON.parse(fs.readFileSync(DATA,'utf8'))}catch{return {guilds:{}}} }
function save(d){ fs.writeFileSync(DATA,JSON.stringify(d,null,2)) }
function cfg(gid){ const d=load(); d.guilds[gid] ||= {welcomeMessage:'👋 Welcome {user} to **{server}**! Check out the rules, choose your notification roles, and enjoy the community.'}; save(d); return d.guilds[gid] }
function update(gid,patch){const d=load();d.guilds[gid]={...(d.guilds[gid]||{}),...patch};save(d);return d.guilds[gid]}
const mentionRole=id=>id?`<@&${id}>`:'';

const rules = [
 ['1. Respect Everyone','Treat members, creators, guests, and staff respectfully. Harassment, bullying, hate speech, slurs, threats, or targeted hostility are prohibited.'],
 ['2. Keep Content Appropriate','Do not post NSFW, sexually explicit, excessively graphic, or otherwise inappropriate content.'],
 ['3. No Spam or Disruption','Avoid message spam, excessive mentions, disruptive soundboards, mic spam, flooding, or intentionally derailing channels.'],
 ['4. Use Channels Correctly','Keep discussions and media in the appropriate channels and follow channel-specific instructions.'],
 ['5. No Scams or Malicious Content','Phishing, malware, token grabbers, fraudulent giveaways, suspicious downloads, and deceptive links are prohibited.'],
 ['6. Advertising & Self-Promotion','Do not advertise servers, channels, streams, products, or social accounts without staff permission.'],
 ['7. Protect Privacy','Do not share private or identifying information about another person without permission.'],
 ['8. Appropriate Profiles','Usernames, nicknames, avatars, bios, and statuses displayed in the community must remain appropriate.'],
 ['9. Voice Chat Conduct','Do not scream, intentionally distort audio, play disruptive sounds, or repeatedly interrupt other members.'],
 ['10. No Impersonation','Do not impersonate Blackoutna1, staff members, other creators, or community members.'],
 ['11. Ticket System','Use tickets for legitimate support needs. Spam tickets, false reports, or harassment through tickets may result in moderation action.'],
 ['12. Follow Staff Direction','Follow reasonable moderation instructions. If you disagree with an action, use the proper support process instead of disrupting public channels.'],
 ['13. Follow Platform Rules','Follow Discord’s Terms and Community Guidelines as well as the rules of games/platforms being discussed or played.'],
 ['14. Enforcement','Staff may warn, mute/time out, remove, or ban members when necessary to enforce these rules. Serious violations may result in immediate action.']
];

async function sendRules(ch){
 const e=new EmbedBuilder().setTitle('📜 Blackoutna1 Community Rules')
 .setDescription('Welcome to the community. These rules are designed to keep the server fun, welcoming, organized, and safe.\n\n'+rules.map(([a,b])=>`**${a}**\n${b}`).join('\n\n'))
 .setFooter({text:'By participating in the server, you are expected to follow these rules.'});
 await ch.send({embeds:[e]});
}

async function sendTicketPanel(ch){
 const e=new EmbedBuilder().setTitle('🎫 Community Support').setDescription('Need assistance or want to contact the staff team? Press **Open Ticket** below. Your ticket will only be visible to you and the configured staff team.');
 const row=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ticket_open').setLabel('Open Ticket').setEmoji('🎫').setStyle(ButtonStyle.Primary));
 await ch.send({embeds:[e],components:[row]});
}

async function sendRolePanel(guild,ch,c){
 const definitions=loadReactionRoles();
 const available=[];
 for(const def of definitions){
  const role=(def.role_id?guild.roles.cache.get(def.role_id):null)||guild.roles.cache.find(r=>r.name===def.role_name);
  if(role) available.push({def,role});
 }
 const description='Choose which notifications you want. Click a button again to remove the role.\n\n'+
  (available.length?available.map(x=>`${x.def.emoji||'🔔'} **${x.def.label}** — ${x.role}`).join('\n'):'No configured reaction roles currently match roles in this server.');
 const e=new EmbedBuilder().setTitle('🎭 Notification Roles').setDescription(description);
 await ch.send({embeds:[e]});
 for(let n=0;n<available.length;n+=5){
  const row=new ActionRowBuilder();
  for(const {def} of available.slice(n,n+5)){
   const b=new ButtonBuilder().setCustomId(`rr_${def.id}`).setLabel(def.label).setStyle(buttonStyle(def.style));
   if(def.emoji) b.setEmoji(def.emoji);
   row.addComponents(b);
  }
  await ch.send({components:[row]});
 }
}
async function postPanels(guild,c){
 const t=await guild.channels.fetch(c.ticketPanel).catch(()=>null); if(t) await sendTicketPanel(t);
 const r=await guild.channels.fetch(c.rolesChannel).catch(()=>null); if(r) await sendRolePanel(guild,r,c);
 const ru=await guild.channels.fetch(c.rulesChannel).catch(()=>null); if(ru) await sendRules(ru);
}

client.once('ready',()=>{
 console.log(`Blackoutna1 Community Bot online as ${client.user.tag}`);
 setInterval(checkYouTube, 5*60*1000);
 setInterval(checkTwitch, 2*60*1000);
 setTimeout(checkYouTube,10000); setTimeout(checkTwitch,15000);
});

client.on('guildMemberAdd',async member=>{
 try{
  const c=cfg(member.guild.id);
  for(const roleId of (c.welcomeRoles||[])){
   const role=member.guild.roles.cache.get(roleId);
   if(role && role.editable) await member.roles.add(role).catch(e=>console.error(`Could not auto-assign ${role.name}:`,e.message));
  }
 }catch(e){ console.error('Auto-role error:',e.message); }

 const c=cfg(member.guild.id); if(!c.welcomeChannel)return;
 const ch=await member.guild.channels.fetch(c.welcomeChannel).catch(()=>null); if(!ch)return;
 const msg=(c.welcomeMessage||'Welcome {user} to {server}!').replaceAll('{user}',`<@${member.id}>`).replaceAll('{server}',member.guild.name);
 const e=new EmbedBuilder().setTitle('👋 Welcome!').setDescription(msg).setThumbnail(member.user.displayAvatarURL());
 await ch.send({content:`<@${member.id}>`,embeds:[e]});
});

client.on('interactionCreate',async i=>{
 if(i.isChatInputCommand()) console.log(`[COMMAND] /${i.commandName} from ${i.user.tag}`);
 if(i.isChatInputCommand()){
  const gid=i.guildId, guild=i.guild;
  if(i.commandName==='setup'){
   await i.deferReply({ephemeral:true});
   const c=update(gid,{
    ticketPanel:i.options.getChannel('ticket_panel').id,
    ticketCategory:i.options.getChannel('ticket_category').id,
    rolesChannel:i.options.getChannel('roles_channel').id,
    rulesChannel:i.options.getChannel('rules_channel').id,
    welcomeChannel:i.options.getChannel('welcome_channel').id,
    announcementChannel:i.options.getChannel('announcement_channel').id,
    youtubeChannel:i.options.getChannel('youtube_channel').id,
    streamChannel:i.options.getChannel('stream_channel').id,
    staffRole:i.options.getRole('staff_role').id,
    youtubeRole:i.options.getRole('youtube_role').id,
    streamRole:i.options.getRole('stream_role').id,
    tiktokRole:i.options.getRole('tiktok_role')?.id||null
   });
   await postPanels(guild,c);
   return i.editReply('✅ Setup saved. Ticket, button-role, and rules panels were posted.');
  }
  if(i.commandName==='configure'){
   await i.deferReply({ephemeral:true});
   const sub=i.options.getSubcommand();
   const c=cfg(gid);
   if(sub==='tickets'){
    const panel=i.options.getChannel('panel_channel'),cat=i.options.getChannel('category'),staff=i.options.getRole('staff_role');
    const patch={};
    if(panel)patch.ticketPanelChannel=panel.id;
    if(cat)patch.ticketCategory=cat.id;
    if(staff)patch.staffRole=staff.id;
    Object.assign(c,update(gid,patch));
    return i.editReply(`✅ Ticket settings updated.\nPanel: ${c.ticketPanelChannel?`<#${c.ticketPanelChannel}>`:'Not set'}\nCategory: ${c.ticketCategory?`<#${c.ticketCategory}>`:'Not set'}\nStaff: ${c.staffRole?`<@&${c.staffRole}>`:'Not set'}`);
   }
   if(sub==='welcome'){
    const ch=i.options.getChannel('channel'),msg=i.options.getString('message');
    const clear=i.options.getBoolean('clear_roles')||false;
    const selected=['role_1','role_2','role_3'].map(n=>i.options.getRole(n)).filter(Boolean);
    const patch={};
    if(ch)patch.welcomeChannel=ch.id;
    if(msg!==null)patch.welcomeMessage=msg;
    if(clear)patch.welcomeRoles=[];
    if(selected.length)patch.welcomeRoles=[...new Set(selected.map(r=>r.id))];
    Object.assign(c,update(gid,patch));
    c.welcomeRoles ||= [];
    return i.editReply(`✅ Welcome settings updated.\nChannel: ${c.welcomeChannel?`<#${c.welcomeChannel}>`:'Not set'}\nMessage: ${c.welcomeMessage||'Default welcome message'}\nAuto roles: ${c.welcomeRoles.length?c.welcomeRoles.map(id=>`<@&${id}>`).join(', '):'None'}`);
   }
   if(sub==='rules'){
    c.rulesChannel=i.options.getChannel('channel').id; update(gid,{rulesChannel:c.rulesChannel});
    return i.editReply(`✅ Rules channel set to <#${c.rulesChannel}>.`);
   }
   if(sub==='announcements'){
    c.announcementChannel=i.options.getChannel('channel').id; update(gid,{announcementChannel:c.announcementChannel});
    return i.editReply(`✅ Announcement channel set to <#${c.announcementChannel}>.`);
   }
   if(sub==='youtube'){
    const ch=i.options.getChannel('channel'),role=i.options.getRole('ping_role');
    const patch={};
    if(ch)patch.youtubeChannel=ch.id;
    if(role)patch.youtubeRole=role.id;
    Object.assign(c,update(gid,patch));
    return i.editReply(`✅ YouTube settings updated.\nChannel: ${c.youtubeChannel?`<#${c.youtubeChannel}>`:'Not set'}\nPing: ${c.youtubeRole?`<@&${c.youtubeRole}>`:'Not set'}`);
   }
   if(sub==='streams'){
    const ch=i.options.getChannel('channel'),role=i.options.getRole('ping_role');
    const patch={};
    if(ch)patch.streamChannel=ch.id;
    if(role)patch.streamRole=role.id;
    Object.assign(c,update(gid,patch));
    return i.editReply(`✅ Stream settings updated.\nChannel: ${c.streamChannel?`<#${c.streamChannel}>`:'Not set'}\nPing: ${c.streamRole?`<@&${c.streamRole}>`:'Not set'}`);
   }
   if(sub==='roles'){
    c.rolesChannel=i.options.getChannel('channel').id; update(gid,{rolesChannel:c.rolesChannel});
    return i.editReply(`✅ Reaction-role panel channel set to <#${c.rolesChannel}>.`);
   }
   if(sub==='view'){
    return i.editReply(
`⚙️ **Current Bot Configuration**
🎫 Ticket panel: ${c.ticketPanelChannel?`<#${c.ticketPanelChannel}>`:'Not set'}
📁 Ticket category: ${c.ticketCategory?`<#${c.ticketCategory}>`:'Not set'}
🛡️ Staff: ${c.staffRole?`<@&${c.staffRole}>`:'Not set'}
👋 Welcome: ${c.welcomeChannel?`<#${c.welcomeChannel}>`:'Not set'}
🎟️ Join roles: ${(c.welcomeRoles||[]).length?c.welcomeRoles.map(id=>`<@&${id}>`).join(', '):'None'}
📜 Rules: ${c.rulesChannel?`<#${c.rulesChannel}>`:'Not set'}
📢 Announcements: ${c.announcementChannel?`<#${c.announcementChannel}>`:'Not set'}
▶️ YouTube: ${c.youtubeChannel?`<#${c.youtubeChannel}>`:'Not set'} ${c.youtubeRole?`<@&${c.youtubeRole}>`:''}
🔴 Streams: ${c.streamChannel?`<#${c.streamChannel}>`:'Not set'} ${c.streamRole?`<@&${c.streamRole}>`:''}
🎭 Reaction roles: ${c.rolesChannel?`<#${c.rolesChannel}>`:'Not set'}`);
   }
   return i.editReply('❌ That configuration option was not recognized.');
  }
  if(i.commandName==='reaction-role'){
   await i.deferReply({ephemeral:true});
   const sub=i.options.getSubcommand();
   const file=loadReactionRoleFile(); file.roles ||= [];
   if(sub==='add'){
    const role=i.options.getRole('role');
    const existing=file.roles.find(r=>r.role_id===role.id || r.role_name===role.name);
    if(existing)return i.editReply('That Discord role is already configured as a button role.');
    const label=i.options.getString('label'),emoji=i.options.getString('emoji')||'',style=i.options.getString('style')||'Secondary';
    file.roles.push({id:roleKey(role.id),role_id:role.id,role_name:role.name,label,emoji,style,enabled:true});
    saveReactionRoleFile(file);
    return i.editReply(`✅ Added ${role} to the reaction-role panel. Run \`/reaction-role refresh\` to post the updated panel.`);
   }
   if(sub==='delete'){
    const role=i.options.getRole('role');
    const before=file.roles.length;
    file.roles=file.roles.filter(r=>r.role_id!==role.id && r.role_name!==role.name);
    if(file.roles.length===before)return i.editReply('That role is not currently configured.');
    saveReactionRoleFile(file);
    return i.editReply(`🗑️ Removed ${role} from the reaction-role configuration. Run \`/reaction-role refresh\` to post the updated panel.`);
   }
   if(sub==='edit'){
    const role=i.options.getRole('role');
    const def=file.roles.find(r=>r.role_id===role.id || r.role_name===role.name);
    if(!def)return i.editReply('That role is not currently configured.');
    const label=i.options.getString('label'),emoji=i.options.getString('emoji'),style=i.options.getString('style');
    def.role_id=role.id; def.role_name=role.name;
    if(label!==null)def.label=label;
    if(emoji!==null)def.emoji=emoji.toUpperCase()==='NONE'?'':emoji;
    if(style!==null)def.style=style;
    saveReactionRoleFile(file);
    return i.editReply(`✏️ Updated ${role}. Run \`/reaction-role refresh\` to post the updated panel.`);
   }
   if(sub==='list'){
    const defs=file.roles.filter(r=>r.enabled!==false);
    return i.editReply(defs.length?defs.map(r=>`${r.emoji||'🔔'} **${r.label}** → ${r.role_id?`<@&${r.role_id}>`:`${r.role_name}`}`).join('\n'):'No reaction roles are configured.');
   }
   if(sub==='refresh'){
    const c=cfg(gid);
    if(!c.rolesChannel)return i.editReply('Run `/setup` first so I know which channel should contain the role panel.');
    const ch=await guild.channels.fetch(c.rolesChannel).catch(()=>null);
    if(!ch)return i.editReply('I could not access the configured roles channel.');
    await sendRolePanel(guild,ch,c);
    return i.editReply(`✅ Posted the updated reaction-role panel in ${ch}.`);
   }
  }
  if(i.commandName==='announcement'){
   const c=cfg(gid), ch=i.options.getChannel('channel')||await guild.channels.fetch(c.announcementChannel);
   const role=i.options.getRole('ping_role');
   const e=new EmbedBuilder().setTitle(`📢 ${i.options.getString('title')}`).setDescription(i.options.getString('message')).setTimestamp().setFooter({text:'Blackoutna1 Community'});
   await ch.send({content:role?role.toString():undefined,embeds:[e],allowedMentions:{roles:role?[role.id]:[]}});
   return i.reply({content:'✅ Announcement sent.',ephemeral:true});
  }
  if(i.commandName==='welcome-message'){
   update(gid,{welcomeMessage:i.options.getString('message')});
   return i.reply({content:'✅ Welcome message updated. Use `{user}` and `{server}` as placeholders.',ephemeral:true});
  }
  if(i.commandName==='settings'){
   const c=cfg(gid);
   const e=new EmbedBuilder().setTitle('⚙️ Blackoutna1 Bot Settings').setDescription(
`🎫 Ticket panel: ${c.ticketPanel?`<#${c.ticketPanel}>`:'Not set'}
📁 Ticket category: ${c.ticketCategory?`<#${c.ticketCategory}>`:'Not set'}
🎭 Roles channel: ${c.rolesChannel?`<#${c.rolesChannel}>`:'Not set'}
📜 Rules: ${c.rulesChannel?`<#${c.rulesChannel}>`:'Not set'}
👋 Welcome: ${c.welcomeChannel?`<#${c.welcomeChannel}>`:'Not set'}
📢 Announcements: ${c.announcementChannel?`<#${c.announcementChannel}>`:'Not set'}
▶️ YouTube: ${c.youtubeChannel?`<#${c.youtubeChannel}>`:'Not set'} ${mentionRole(c.youtubeRole)}
🔴 Streams: ${c.streamChannel?`<#${c.streamChannel}>`:'Not set'} ${mentionRole(c.streamRole)}
🛡️ Staff: ${mentionRole(c.staffRole)}`);
   return i.reply({embeds:[e],ephemeral:true});
  }
  if(i.commandName==='post-panels'){
   await i.deferReply({ephemeral:true}); await postPanels(guild,cfg(gid)); return i.editReply('✅ Panels reposted.');
  }
  if(i.commandName==='video'){
   const c=cfg(gid),ch=await guild.channels.fetch(c.youtubeChannel); const url=i.options.getString('url'),title=i.options.getString('title')||'New Blackoutna1 Video';
   const e=new EmbedBuilder().setTitle(`▶️ ${title}`).setDescription(`A new video is available now!\n\n${url}`).setTimestamp();
   await ch.send({content:mentionRole(c.youtubeRole),embeds:[e],allowedMentions:{roles:[c.youtubeRole]}});
   return i.reply({content:'✅ Video notification sent.',ephemeral:true});
  }
  if(i.commandName==='stream'){
   const c=cfg(gid),ch=await guild.channels.fetch(c.streamChannel); const url=i.options.getString('url'),title=i.options.getString('title')||'Blackoutna1 Is Live!';
   const e=new EmbedBuilder().setTitle(`🔴 ${title}`).setDescription(`The stream is live now!\n\n${url}`).setTimestamp();
   await ch.send({content:mentionRole(c.streamRole),embeds:[e],allowedMentions:{roles:[c.streamRole]}});
   return i.reply({content:'✅ Stream notification sent.',ephemeral:true});
  }
 }

 if(!i.isButton())return;
 const c=cfg(i.guildId);

 if(i.customId==='ticket_open'){
  await i.deferReply({ephemeral:true});
  const existing=i.guild.channels.cache.find(ch=>ch.topic===`ticket-owner:${i.user.id}`);
  if(existing)return i.editReply(`You already have an open ticket: ${existing}`);
  const cat=await i.guild.channels.fetch(c.ticketCategory).catch(()=>null);
  const staff=await i.guild.roles.fetch(c.staffRole).catch(()=>null);
  const opener=await i.guild.members.fetch(i.user.id).catch(()=>null);
  const botMember=i.guild.members.me || await i.guild.members.fetchMe().catch(()=>null);
  if(!cat||!staff||!opener||!botMember)return i.editReply('Ticket system is not configured correctly. Re-select the ticket category and Staff role with `/configure tickets`.');
  const safe=i.user.username.toLowerCase().replace(/[^a-z0-9-]/g,'').slice(0,18)||'member';
  const ch=await i.guild.channels.create({
   name:`🎫-${safe}`,
   type:ChannelType.GuildText,parent:cat.id,topic:`ticket-owner:${i.user.id}`,
   permissionOverwrites:[
    {id:i.guild.roles.everyone,deny:[PermissionFlagsBits.ViewChannel]},
    {id:opener,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory,PermissionFlagsBits.AttachFiles]},
    {id:staff,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ReadMessageHistory,PermissionFlagsBits.ManageMessages]},
    {id:botMember,allow:[PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages,PermissionFlagsBits.ManageChannels]}
   ]
  }).catch(async err=>{
   console.error('Ticket creation failed:',err);
   await i.editReply('❌ Ticket creation failed. Check the bot permissions and run `/configure tickets` again.').catch(()=>{});
   return null;
  });
  if(!ch)return;
  const row=new ActionRowBuilder().addComponents(
   new ButtonBuilder().setCustomId('ticket_claim').setLabel('Claim').setEmoji('🛡️').setStyle(ButtonStyle.Secondary),
   new ButtonBuilder().setCustomId('ticket_close').setLabel('Close Ticket').setEmoji('🔒').setStyle(ButtonStyle.Danger)
  );
  const e=new EmbedBuilder().setTitle('🎫 Support Ticket').setDescription(`${i.user}, thank you for contacting the team.\n\nPlease explain what you need help with. ${staff} has been notified.`);
  await ch.send({content:`${i.user} ${staff}`,embeds:[e],components:[row],allowedMentions:{users:[i.user.id],roles:[staff.id]}});
  return i.editReply(`✅ Ticket created: ${ch}`);
 }

 if(i.customId.startsWith('rr_')){
  const key=i.customId.slice(3);
  const def=loadReactionRoles().find(r=>r.id===key);
  if(!def)return i.reply({content:'That button role is no longer configured.',ephemeral:true});
  const role=(def.role_id?i.guild.roles.cache.get(def.role_id):null)||i.guild.roles.cache.find(r=>r.name===def.role_name);
  if(!role)return i.reply({content:`I could not find the Discord role "${def.role_name}". Make sure role_name in reaction-roles.json exactly matches the server role.`,ephemeral:true});
  const member=await i.guild.members.fetch(i.user.id);
  if(member.roles.cache.has(role.id)){
   await member.roles.remove(role.id);
   return i.reply({content:`➖ Removed ${role}.`,ephemeral:true});
  }
  await member.roles.add(role.id);
  return i.reply({content:`✅ Added ${role}.`,ephemeral:true});
 }

 if(i.customId==='ticket_claim'){
  const staff=await i.guild.roles.fetch(c.staffRole); if(!i.member.roles.cache.has(staff.id)&&!i.memberPermissions.has(PermissionFlagsBits.Administrator)) return i.reply({content:'Staff only.',ephemeral:true});
  return i.reply({content:`🛡️ Ticket claimed by ${i.user}.`});
 }
 if(i.customId==='ticket_close'){
  const owner=i.channel.topic?.split(':')[1];
  const staff=await i.guild.roles.fetch(c.staffRole);
  if(i.user.id!==owner&&!i.member.roles.cache.has(staff.id)&&!i.memberPermissions.has(PermissionFlagsBits.Administrator)) return i.reply({content:'Only the ticket creator or staff can close this ticket.',ephemeral:true});
  await i.reply('🔒 Closing this ticket in 5 seconds...');
  setTimeout(()=>i.channel.delete('Ticket closed').catch(()=>{}),5000);
 }
});

async function checkYouTube(){
 const id=process.env.YOUTUBE_CHANNEL_ID;if(!id)return;
 try{
  const feed=await parser.parseURL(`https://www.youtube.com/feeds/videos.xml?channel_id=${id}`);
  const item=feed.items?.[0];if(!item)return;
  const d=load();
  for(const [gid,c] of Object.entries(d.guilds||{})){
   if(!c.youtubeChannel||!c.youtubeRole||c.lastYoutube===item.id)continue;
   if(!c.lastYoutube){c.lastYoutube=item.id;save(d);continue}
   const g=client.guilds.cache.get(gid),ch=g&&await g.channels.fetch(c.youtubeChannel).catch(()=>null);if(!ch)continue;
   const e=new EmbedBuilder().setTitle(`▶️ ${item.title}`).setDescription(`A new Blackoutna1 video just dropped!\n\n${item.link}`).setTimestamp();
   await ch.send({content:mentionRole(c.youtubeRole),embeds:[e],allowedMentions:{roles:[c.youtubeRole]}});
   c.lastYoutube=item.id;save(d);
  }
 }catch(e){console.error('YouTube check:',e.message)}
}

let twitchToken=null,twitchExpires=0;
async function twitchAuth(){
 if(!process.env.TWITCH_CLIENT_ID||!process.env.TWITCH_CLIENT_SECRET)return null;
 if(twitchToken&&Date.now()<twitchExpires)return twitchToken;
 const r=await fetch(`https://id.twitch.tv/oauth2/token?client_id=${encodeURIComponent(process.env.TWITCH_CLIENT_ID)}&client_secret=${encodeURIComponent(process.env.TWITCH_CLIENT_SECRET)}&grant_type=client_credentials`,{method:'POST'});
 const j=await r.json();twitchToken=j.access_token;twitchExpires=Date.now()+(j.expires_in-60)*1000;return twitchToken;
}
async function checkTwitch(){
 const username=process.env.TWITCH_USERNAME;if(!username)return;
 try{
  const token=await twitchAuth();if(!token)return;
  const r=await fetch(`https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(username)}`,{headers:{'Client-ID':process.env.TWITCH_CLIENT_ID,'Authorization':`Bearer ${token}`}});
  const j=await r.json(),live=j.data?.[0]||null,d=load();
  for(const [gid,c] of Object.entries(d.guilds||{})){
   if(!c.streamChannel||!c.streamRole)continue;
   const key=live?.id||null;
   if(live&&c.lastTwitchStream!==key){
    const g=client.guilds.cache.get(gid),ch=g&&await g.channels.fetch(c.streamChannel).catch(()=>null);if(!ch)continue;
    const url=`https://www.twitch.tv/${username}`;
    const e=new EmbedBuilder().setTitle(`🔴 ${username} is LIVE!`).setDescription(`**${live.title||'Live now'}**\n\n${url}`).setTimestamp();
    await ch.send({content:mentionRole(c.streamRole),embeds:[e],allowedMentions:{roles:[c.streamRole]}});
    c.lastTwitchStream=key;save(d);
   }
   if(!live&&c.lastTwitchStream){c.lastTwitchStream=null;save(d)}
  }
 }catch(e){console.error('Twitch check:',e.message)}
}

client.login(process.env.DISCORD_TOKEN);

process.on('unhandledRejection',err=>console.error('Unhandled promise rejection:',err));
process.on('uncaughtException',err=>console.error('Uncaught exception:',err));
