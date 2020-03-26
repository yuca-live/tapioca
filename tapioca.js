const token = process.env.SLACK_APP_CODE || 'xoxb-781443478864-1028546596837-gVXYNlqiYOq5SsJmHP5r0l05';
const Slack = require('slack');
const bot = new Slack({ token });
const GROUP_SIZE = process.env.SLACK_SIZE || 1;
const CHANNEL_NAME = process.env.CHANNEL_NAME || 'tapioca';
let DEFAULT_MESSAGE = 'Don’t let social distancing bring you down. Catch up with your team, '
  + 'feel all warm and fuzzy inside over Tapioca.';

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

            return bot.chat.postMessage({ channel: channelId, text });
          });
      }));
    })
    .catch((e) => console.log(e));
};