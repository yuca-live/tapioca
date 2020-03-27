const Slack = require('slack');
const request = require('request-promise-native');
const AWS = require('aws-sdk');
// S3 configs
const s3 = new AWS.S3({
  accessKeyId: process.env.S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
});
const S3_BUCKET = 'tapioca-time';
const S3_TOKENS_FILE = 'tapioca-tokens.json';
// SLACK configs
const appClientId = process.env.APP_CLIENT_ID;
const appClientSecret = process.env.APP_CLIENT_SECRET;
const tapiocaChannelName = 'tapioca-time';


const getTokensFile = () => {
  console.log('getTokensFile');

  try {
    const params = {
      Bucket: S3_BUCKET,
      Key: S3_TOKENS_FILE,
    };

    console.log('getTokensFile A');

    return s3.getObject(params).promise().then(
      (data) => {
        const fileContents = JSON.parse(data.Body.toString('utf-8'));
        return fileContents;
      },
    );
  } catch (e) {
    console.log('ERROR GET TOKENS FILE', JSON.stringify(e));
    throw e;
  }
};

const putToTokensFile = (body) => {
  console.log('putToTokensFile', body);
  return getTokensFile()
    .then(
      (data) => {
        data.push(body);
        return data;
      },
    ).catch((error) => {
      console.log('ERROR DO PUT TO TOKEN', JSON.stringify(error));
    })
    .then((data) => {
      console.log('DATA', data);
      const params = {
        Bucket: S3_BUCKET,
        Key: S3_TOKENS_FILE,
        Body: JSON.stringify(data),
        ContentType: 'application/json',
      };
      return s3.upload(params).promise();
    })
    .then((uploadResult) => {
      console.log('UPLOAD RESULT', uploadResult);
      return uploadResult;
    });
};

exports.handler = async (event, context, callback) => {
  const { code } = event.queryStringParameters;

  // When a user authorizes an app, a code query parameter is passed on the oAuth endpoint. If that code is not there, we respond with an error message
  if (!code) {
    const msg = "Looks like we're not getting code.";
    console.log(msg);
    callback(msg);
  } else {
    console.log('CODE:', code);
    await request.post(
      {
        url: 'https://slack.com/api/oauth.v2.access',
        qs: { code, client_id: appClientId, client_secret: appClientSecret },
        header: {
          'Content-type': 'application/x-www-form-urlencoded',
        },
      })
      .then((result) => {
        console.log('THEN AFTER REQUEST', result);
        const body = JSON.parse(result);
        const bot = new Slack({ token: body.access_token });
        return bot.conversations.create({ name: tapiocaChannelName })
          .then((data) => {
            console.log(`DATA ${JSON.stringify(data)}`);
            return { channelId: data.channelId, accessToken: body.access_token };
          })
          .catch((error) => {
            console.log('CHANNEL NOT CREATED!', JSON.stringify(error));
            return bot.channels.list()
              .then((data) => {
                if (data.ok) {
                  return data.channels.find((c) => c.name === tapiocaChannelName);
                }
                throw new Error('could not find donut channel');
              })
              .then((channel) => {
                console.log('CHANNEL', channel);
                return { channelId: channel.id, accessToken: body.access_token };
              });
          });
      })
      .then((s3Body) => {
        console.log('S3 BODY', s3Body);
        return putToTokensFile(s3Body);
      })
      .then(() => {
        // ?????
        // redirect to success page???
        callback(null, { status: 'success' });
      })
      .catch((err) => {
        console.log('ERROR', err);
        console.log('ERROR MESSAGE', err.errorMessage);
        callback({ status: 'failed' });
        // ?????
        // redirect to error page???
      });
  }
};
