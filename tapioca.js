const Slack = require('slack');
const AWS = require('aws-sdk');
const { conversationStarters, defaultMessage } = require('./constants');

const GROUP_SIZE = parseInt(process.env.SLACK_SIZE);

const getCurrentCredentialsFile = async () => {
  const s3 = new AWS.S3({
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  });

  try {
    const params = {
      Bucket: 'tapioca-time',
      Key: 'tapioca-tokens.json',
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
  if (array.length) {
    const randomNumber = Math.random() * 10000;
    const cutIndex = Math.floor((Math.random() * randomNumber) % array.length);
    return array.splice(cutIndex, 1)[0];
  }
  return {};
};

const getRandomUser = (usersArray) => {
  const user = getRandom(usersArray);
  const { id, real_name, locale } = user;
  return { id, real_name, locale };
};

const getUsersFromChannel = async (slack, channelId) => {
  const membersData = await slack.conversations.members({ channel: channelId });
  if (!membersData.ok) {
    throw new Error('could not find channel members');
  }
  const usersData = await Promise.all(membersData.members.map(async (user) => slack.users.info({ user, include_locale: true })));
  const users = usersData.map((dataRow) => dataRow.user).filter((user) => !user.is_bot);
  return users;
};

const getLeftBehindPeople = (users) => {
  const leftBehindPeople = [];
  const remainingPeople = users.length % GROUP_SIZE;
  for (let i = 0; i < remainingPeople; i++) {
    leftBehindPeople.push(getRandomUser(users));
  }
  return leftBehindPeople;
};

const shuffle = (originalArray) => {
  // https://stackoverflow.com/a/2450976
  const array = [...originalArray];
  let currentIndex = array.length;
  let temporaryValue;
  let randomIndex;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {
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
  const groupsCount = shuffledUsers.length / GROUP_SIZE;
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
    // user on endIndex position was already used on the last group, so we move to the next one.
    endIndex += 1;
    for (let i = 0; i < remainder; i += 1) {
      groups[i].push(endIndex + i);
    }
  }

  return groups;
};

const createConversationAndPostMessage = async (slack, group, leftBehindPeople) => {
  if (leftBehindPeople.length) {
    group.push(leftBehindPeople.shift());
  }

  console.log('HANDLING GROUP ', group);
  const userIds = group.map((user) => user.id).join(',');
  const { locale } = group[0];
  console.log('CREATE CONVERSATION WITH USERS: ', userIds);
  const conversationData = await slack.conversations.open({ users: userIds });
  if (!conversationData.ok) {
    throw new Error('could not open conversation');
  }
  const channelId = conversationData.channel.id;
  const text = defaultMessage[locale] || defaultMessage.default;
  const localizedMessages = conversationStarters[locale] || conversationStarters.default;
  const attachments = [{ text: getRandom(localizedMessages) }];
  console.log('SEND MESSAGE');
  return slack.chat.postMessage({ channel: channelId, text, attachments }).then((postResult) => console.log(postResult));
}

exports.handler = async () => {

  const handledTeams = {};
  const teamTokens = await getCurrentCredentialsFile();
  if (!teamTokens) {
    throw new Error('Could not get Tokens file');
  }
  const uniqueTokens = {};
  teamTokens.forEach((token) => {
    uniqueTokens[token.teamId] = token;
  });
  console.log('TEAM TOKENS', teamTokens);

  return Promise.all(Object.values(uniqueTokens).map(async (teamData) => {
    try {
      if (handledTeams[teamData.teamId]) {
        return null;
      }
      console.log('HANDLING TEAM: ', teamData);
      const slack = new Slack({ token: teamData.accessToken });
      const users = await getUsersFromChannel(slack, teamData.channelId);
      const leftBehindPeople = getLeftBehindPeople(users);
      const allGroups = createUsersGroups(users);
      handledTeams[teamData.teamId] = true;
      return Promise.all(allGroups.map((group) => createConversationAndPostMessage(slack, group, leftBehindPeople)));
    } catch (e) {
      console.error(e);
      return null;
    }
  }));
};
