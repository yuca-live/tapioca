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

const successTapiocaPageRedirect = process.env.SUCCESS_TAPIOCA_PAGE;
const failtTapiocaPageRedirect = process.env.FAIL_TAPIOCA_PAGE;


const getTokensFile = () => {
  try {
    const params = {
      Bucket: S3_BUCKET,
      Key: S3_TOKENS_FILE,
    };

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
  console.log(`Getting ${S3_TOKENS_FILE} file on S3`);
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
      console.log(`Saving new ${S3_TOKENS_FILE} file with new Slack token on S3`);
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
  console.log('Request received to register Slack workspace on app');
  const { code } = event.queryStringParameters;

  // When a user authorizes an app, a code query parameter is passed on the oAuth endpoint. If that code is not there, we respond with an error message
  if (!code) {
    const msg = "Looks like we're not getting code.";
    console.log(msg);
    callback(msg);
  } else {
    console.log('Geting access token on Slack');
    await request.post(
      {
        url: 'https://slack.com/api/oauth.v2.access',
        qs: { code, client_id: appClientId, client_secret: appClientSecret },
        header: {
          'Content-type': 'application/x-www-form-urlencoded',
        },
      })
      .then((result) => {
        const body = JSON.parse(result);
        const bot = new Slack({ token: body.access_token });
        console.log(`Creating ${tapiocaChannelName} channel on Slack`);
        return bot.conversations.create({ name: tapiocaChannelName })
          .then((data) => {
            return { channelId: data.channelId, accessToken: body.access_token };
          })
          .catch((error) => {
            return bot.channels.list()
              .then((data) => {
                if (data.ok) {
                  return data.channels.find((c) => c.name === tapiocaChannelName);
                }
                throw new Error('could not find donut channel');
              })
              .then((channel) => {
                return { channelId: channel.id, accessToken: body.access_token };
              });
          });
      })
      .then((s3Body) => {
        return putToTokensFile(s3Body);
      })
      .then(() => {
        const response = {
          statusCode: 301,
          headers: {
            Location: successTapiocaPageRedirect,
          }
        };
        return callback(null, response);
      })
      .catch((err) => {
        console.log('ERROR', err);
        console.log('ERROR MESSAGE', err.errorMessage);
        const response = {
          statusCode: 500,
          headers: {
            Location: failtTapiocaPageRedirect,
          }
        };
        return callback(null, response);
      });
  }
};
