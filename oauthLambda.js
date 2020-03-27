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


const getTokensFile = async () => {
  const params = {
    Bucket: S3_BUCKET,
    Key: S3_TOKENS_FILE,
  };
  const data = await s3.getObject(params).promise();
  const fileContents = JSON.parse(data.Body.toString('utf-8'));
  return fileContents;
};

const putToTokensFile = async (body) => {
  const tokenFiles = await getTokensFile();
  tokenFiles.push(body);
  const params = {
    Bucket: S3_BUCKET,
    Key: S3_TOKENS_FILE,
    Body: JSON.stringify(tokenFiles),
    ContentType: 'application/json',
  };
  const uploadResult = await s3.upload(params).promise();
  return uploadResult;
};

exports.handler = async (event, context, callback) => {
  const { code } = event.queryStringParameters;

  try {
    // When a user authorizes an app, a code query parameter is passed on the oAuth endpoint. If that code is not there, we respond with an error message
    if (!code) {
      const msg = "Looks like we're not getting code.";
      return callback(msg);
    }

    const oauthResult = await request.post({
      url: 'https://slack.com/api/oauth.v2.access',
      qs: { code, client_id: appClientId, client_secret: appClientSecret },
      header: {
        'Content-type': 'application/x-www-form-urlencoded',
      },
    });
    const body = JSON.parse(oauthResult);
    const slack = new Slack({ token: body.access_token });
    let tokensData = {};
    try {
      const channelReqData = await slack.conversations.create({ name: tapiocaChannelName });
      tokensData = {
        channelId: channelReqData.channelId,
        accessToken: body.access_token,
      };
    } catch (error) {
      const channelsListReqData = await slack.channels.list();
      if (!channelsListReqData.ok) {
        throw new Error('could not find donut channel');
      }
      const channel = channelsListReqData.channels.find((c) => c.name === tapiocaChannelName);
      tokensData = {
        channelId: channel.id,
        accessToken: body.access_token,
      };
    }
    await putToTokensFile(tokensData);
    return callback(null, { status: 'success' });
  } catch (error) {
    console.error('ERROR', error);
    console.error('ERROR MESSAGE', error.message);
    return callback({ status: 'failed' });
  }
};
