const Slack = require('slack');
const AWS = require('aws-sdk');
const { conversationStarters } = require('./constants');

const GROUP_SIZE = process.env.SLACK_SIZE || 3;
let DEFAULT_MESSAGE = '*Don’t let social distancing bring you down. Catch up with your team, '
  + 'feel all warm and fuzzy inside over Tapioca.*';

const getCurrentCredentialsFile = () => {
  console.log('A');
  const s3 = new AWS.S3({
    accessKeyId: 'AKIAWX7WCPGNIU7XYJID',
    secretAccessKey: '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',
  });
  console.log('B');

  try {
    const params = {
      Bucket: 'tapioca-time',
      Key: 'tapioca-tokens.json',
    };

    console.log('C');

    return s3.getObject(params).promise().then(
      (data) => {
        const fileContents = JSON.parse(data.Body.toString('utf-8'));
        return fileContents;
      },
    );
  } catch (e) {
    console.log('EITA LASCOU TUDO', e);
    return { error: 'deu ruim', e };
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

  console.log('DefaultMessage', DEFAULT_MESSAGE);

  await getCurrentCredentialsFile().then(async (companiesTokens) => {
    console.log('COMPANI TOKENS', companiesTokens);

    const promises = companiesTokens.map((companyData) => {
      console.log('HANDLING COMPNAY: ', companyData);
      const bot = new Slack({ token: companyData.accessToken });
      return bot.conversations.members({ channel: companyData.channelId })
        .then((data) => {
          console.log('D');

          if (data.ok) {
            console.log('E');
            return Promise.all(data.members.map((user) => bot.users.info({ user })));
          }
          console.log('F');
          throw new Error('could not find channel members');
        })
        .then((data) => {
          console.log('G');
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
                const attachments = [{ "text": getRandom(conversationStarters) }];

                return bot.chat.postMessage({ channel: channelId, text, attachments });
              });
          }));
        })
        .catch((e) => console.log(e));
    });

    return Promise.all(promises);
  });
};
