const Slack = require('slack');
const AWS = require('aws-sdk');
const { conversationStarters } = require('./constants');

const GROUP_SIZE = process.env.SLACK_SIZE;
let DEFAULT_MESSAGE = '*Don’t let social distancing bring you down. Catch up with your team, '
  + 'feel all warm and fuzzy inside over Tapioca.*';

const getCurrentCredentialsFile = () => {
  const s3 = new AWS.S3({
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  });

  try {

    const params = {
      Bucket: 'tapioca-time',
      Key: 'tapioca-tokens.json',
    };

    const data = await s3.getObject(params).promise()
    const fileContents = JSON.parse(data.Body.toString('utf-8'));
    return fileContents;

  } catch (e) {
    console.error(e)
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
  const { id, real_name } = user;
  return { id, real_name };
};

const getUsersFromChannel = async (slack, channelId) => {
  const membersData = await bot.conversations.members({ channel: channelId })
  if (!membersData.ok) {
    throw new Error('could not find channel members');
  }
  const usersData = await Promise.all(membersData.members.map((user) => bot.users.info({ user })));
  const users = usersData.map((dataRow) => dataRow.user).filter((user) => !user.is_bot);
  return users;
}

const getLeftBehindPeople = (users) => {
  const leftBehindPeople = [];
  const remainingPeople = users.length % GROUP_SIZE;  
  for (let i = 0; i < remainingPeople; i++) {
    leftBehindPeople.push(getRandomUser(users));
  }
  return leftBehindPeople;
}

const createUsersGroups = (users) => {
  const allGroups = [];
  while (users.length) {
    const group = [];
    for (let i = 0; i < GROUP_SIZE; i++) {
      group.push(getRandomUser(users));
    }
    allGroups.push(group);
  }
  return allGroups;
}

const createConversationAndPostMessage = async (slack, group, leftBehindPeople) => {
  if (leftBehindPeople.length) {
    group.push(leftBehindPeople.shift());
  }

  const userIds = group.map((user) => user.id).join(',');
  const conversationData = await slack.conversations.open({ users: userIds })
  if (!conversationData.ok) {
    throw new Error('could not open conversation');
  }
  const channelId = conversationData.channel.id;
  const text = DEFAULT_MESSAGE;
  const attachments = [{ "text": getRandom(conversationStarters) }];
  return slack.chat.postMessage({ channel: channelId, text, attachments });
}

exports.handler = async () => {

  console.log('DefaultMessage', DEFAULT_MESSAGE);

  const companiesTokens = await getCurrentCredentialsFile()
  console.log('COMPANY TOKENS', companiesTokens);

  return companiesTokens && companiesTokens.map( async (companyData) => {
    try {
      console.log('HANDLING COMPANY: ', companyData);
      const slack = new Slack({ token: companyData.accessToken });
      const users = await getUsersFromChannel(slack, company.channelId);
      const leftBehindPeople = getLeftBehindPeople(users);
      const allGroups = createUsersGroups(users);
      return allGroups.map( (group) => createConversationAndPostMessage(slack, group, leftBehindPeople) );
    } catch (e) {
      console.error(e)
    }
  });
};
