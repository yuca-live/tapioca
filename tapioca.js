const token = process.env.SLACK_APP_CODE || 'xoxb-781443478864-1028546596837-gVXYNlqiYOq5SsJmHP5r0l05';
const Slack = require('slack');
const AWS = require('aws-sdk');
const { conversationStarters } = require('./constants');

const GROUP_SIZE = process.env.SLACK_SIZE || 1;
const CHANNEL_NAME = process.env.CHANNEL_NAME || 'tapioca-test';
let DEFAULT_MESSAGE = '*Don’t let social distancing bring you down. Catch up with your team, '
  + 'feel all warm and fuzzy inside over Tapioca.*';


const getCurrentCredentialsFile = () => {
  const s3 = new AWS.S3({
    accessKeyId: process.env.ACCESS_KEY_ID || 'KIAWX7WCPGNLJCZM6OO',
    secretAccessKey:  process.env.SECRET_ACCESS_KEY || 'Sfws5YB+VETL9fU8zd63bTYx0kVrRy1yq/smNFFd',
  });

  s3.getObject({
      Bucket: 'tapioca-time',
      Key: 'tokens.js'
    }
  ).promise()
  .then((response) => {

    console.log('response', response);
    const body = response.body;
    console.log("CREDENTIALS SAVED:", body);
  });
};

const callback = (response) => {
};

const getS3BukecktData = (bucketName) => {
  const bucketParams = {
    Bucket : bucketName,
  };
  try {
    s3.listObjects(bucketParams, (err, data) => {
      if (err) {
        console.log('err', err);
        throw err;
      } else {
        return data;
      }
    });
  } catch (err) {
    console.log('err', err);
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

exports.handler = async () => {
  const bot = new Slack({ token });
  console.log('return value', getCurrentCredentialsFile());
  console.log('DefaultMessage', DEFAULT_MESSAGE);
  /*
  await bot
    .channels
    .list()
    .then((data) => {
      if (data.ok) {
        return data.channels.find((c) => c.name === CHANNEL_NAME);
      }
      throw new Error('could not find tapioca channel');
    })
    .then((tapiocaChannel) => bot.conversations.members({ channel: tapiocaChannel.id }))
    .then((data) => {
      if (data.ok) {
        return Promise.all(data.members.map((user) => bot.users.info({ user })));
      }
      throw new Error('could not find channel members');
    })
    .then((data) => {
      const users = data.map((dataRow) => dataRow.user).filter((user) => !user.is_bot);

      const remainingPeople = users.length % GROUP_SIZE;
      const leftBehindPeople = [];
      for (let i = 0; i < remainingPeople; i++) {
        leftBehindPeople.push(getRandomUser(users));
      }

      const allGroups = [];
      while (users.length) {
        const group = [];
        for (let i = 0; i < GROUP_SIZE; i++) {
          group.push(getRandomUser(users));
        }
        allGroups.push(group);
      }

      return Promise.all(allGroups.map((group) => {
        if (leftBehindPeople.length) {
          group.push(leftBehindPeople.shift());
        }

        const userIds = group.map((user) => user.id).join(',');
        return bot.conversations
          .open({ users: userIds })
          .then((data) => {
            const channelId = data.channel.id;

            const text = DEFAULT_MESSAGE;
            const attachments = [{"text": getRandom(conversationStarters)}];

            return bot.chat.postMessage({ channel: channelId, text, attachments });
          });
      }));
    })
    .catch((e) => console.log(e));
    */
};