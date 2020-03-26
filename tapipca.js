const token = process.env.SLACK_APP_CODE;

const Slack = require('slack');

const bot = new Slack({ token });

const GROUP_SIZE = process.env.SLACK_SIZE;

const CHANNEL_NAME = process.env.CHANNEL_NAME;

let DEFAULT_MESSAGE = 'Esse isolamento tá pegando né?!\n';
DEFAULT_MESSAGE += 'Vamos fazer um hangouts, tomar um café :coffee: juntos e jogar uns 15 minutinhos :clock3: de conversa fora?\n';

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

exports.handler = async (event) => {
  await bot
    .channels
    .list()
    .then((data) => {
      if (data.ok) {
        return data.channels.find((c) => c.name === CHANNEL_NAME);
      }
      throw new Error('could not find donut channel');
    })
    .then((donutChannel) => bot.conversations.members({ channel: donutChannel.id }))
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

            return bot.chat.postMessage({ channel: channelId, text });
          });
      }));
    })
    .catch((e) => console.log(e));
};