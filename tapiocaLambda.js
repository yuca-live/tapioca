const Slack = require('slack');
const AWS = require('aws-sdk');
const { conversationStarters, defaultMessage } = require('./constants');

const GROUP_SIZE = parseInt(process.env.SLACK_SIZE, 10);
const CHANNEL_SIZE_LIMIT = parseInt(process.env.CHANNEL_SIZE_LIMIT, 10);

const getCurrentCredentialsFile = async () => {
  const s3 = new AWS.S3({
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  });

  try {
    const params = {
      Bucket: process.env.BUCKET_NAME,
      Key: process.env.BUCKET_FILE_NAME,
    };

    const data = await s3.getObject(params).promise();
    const fileContents = JSON.parse(data.Body.toString('utf-8'));
    return fileContents;
  } catch (e) {
    console.error(e);
    return null;
  }
};

const getRandom = (array) => {
  const randomIndex = Math.floor(Math.random() * array.length);
  return array[randomIndex];
};

const getUsersFromChannel = async (slack, channelId) => {
  console.info(`getUsersFromChannel loading users from channelId=${channelId}`);
  const membersData = await slack.conversations.members({
    channel: channelId,
    limit: CHANNEL_SIZE_LIMIT,
  });
  if (!membersData.ok) {
    throw new Error(`could not find members for channelId=${channelId}`);
  }
  const usersData = await Promise.all(membersData.members.map(async (user) => {
    console.info(`getUsersFromChannel loading data for userId=${user}`);
    return slack.users.info({ user, include_locale: true });
  }));
  const usersOnly = usersData.map((dataRow) => dataRow.user).filter((user) => !user.is_bot);
  return usersOnly;
};

const shuffle = (originalArray) => {
  // https://stackoverflow.com/a/2450976
  const array = [...originalArray];
  let currentIndex = array.length;
  let temporaryValue;
  let randomIndex;

  // While there remain elements to shuffle...
  while (currentIndex !== 0) {
    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
};

const createUsersGroups = (users) => {
  const groups = [];
  const shuffledUsers = shuffle(users);

  const groupsCount = Math.floor(shuffledUsers.length / GROUP_SIZE);
  const remainder = shuffledUsers.length % GROUP_SIZE;
  let startIndex = 0;
  let endIndex = 0;
  for (let i = 0; i < groupsCount; i += 1) {
    startIndex = i * GROUP_SIZE;
    endIndex = startIndex + GROUP_SIZE;
    groups.push(shuffledUsers.slice(startIndex, endIndex));
  }

  // Assign each of remainder users on a different group.
  if (remainder > 0) {
    for (let i = 0; i < remainder; i += 1) {
      groups[i].push(shuffledUsers[endIndex + i]);
    }
  }

  return groups;
};

const createConversationAndPostMessage = async (slack, group) => {
  const userIds = group.map((user) => user.id).join(',');
  const { locale } = group[0];
  console.info(`createConversationAndPostMessage creating conversation with users=${userIds}`);
  const conversationData = await slack.conversations.open({ users: userIds });
  if (!conversationData.ok) {
    throw new Error('could not open conversation');
  }
  const channelId = conversationData.channel.id;
  const text = defaultMessage[locale] || defaultMessage.default;
  const localizedMessages = conversationStarters[locale] || conversationStarters.default;
  const attachments = [{ text: getRandom(localizedMessages) }];
  console.info(`createConversationAndPostMessage sending message=${JSON.stringify(attachments)}, for users=${userIds}`);
  return slack.chat.postMessage({ channel: channelId, text, attachments })
    .then((postResult) => console.info('createConversationAndPostMessage slack postMessage result=', JSON.stringify(postResult)))
    .catch((e) => console.error(`createConversationAndPostMessage could not create conversation for group=${JSON.stringify(group)}`, e));
};

exports.handler = async () => {
  console.info('handler tapioca conversation maker started.');
  const handledTeams = {};
  const teamTokens = await getCurrentCredentialsFile();
  if (!teamTokens) {
    throw new Error('Could not get Tokens file. Aborting.');
  }

  const uniqueTokens = {};
  teamTokens.forEach((token) => {
    uniqueTokens[token.teamId] = token;
  });

  console.info(`handler teamTokens loaded successfully, size=${teamTokens.length}, unique=${Object.keys(uniqueTokens).length}`);

  const jobs = Object.values(uniqueTokens).map(async (teamData) => {
    try {
      if (handledTeams[teamData.teamId]) {
        console.info(`handler teamId=${teamData.teamId} already handled. Ignoring`);
        return null;
      }
      console.info(`handler running for team=${JSON.stringify(teamData)}`);
      const slack = new Slack({ token: teamData.accessToken });
      const users = await getUsersFromChannel(slack, teamData.channelId);
      const allGroups = createUsersGroups(users);
      console.info(`handler team=${teamData.teamId} has usersCount=${users.length} into groupsCount=${allGroups.length}`
        + ` groupSize=${GROUP_SIZE}`);
      handledTeams[teamData.teamId] = true;
      const groupJobs = allGroups.map((group) => createConversationAndPostMessage(slack, group));
      return Promise.all(groupJobs)
        .catch((e) => console.error(`handler could not handle correctly teamId=${teamData.teamId}`, e));
    } catch (e) {
      console.error(`handler could not run for teamData=${JSON.stringify(teamData)}`, e);
      return Promise.resolve(); // As we use a promise all, even if a group has failed it cannot return Promise.reject.
    }
  });

  return Promise.all(jobs)
    .catch((e) => console.error('Something unexpected happened.', e))
    .then(() => console.info('handler tapioca conversation maker finished'));
};
