const Slack = require('slack');
const request = require('request-promise-native');
const AWS = require('aws-sdk');
// S3 configs
const s3 = new AWS.S3({
  accessKeyId: process.env.S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
});
const S3_BUCKET = process.env.S3_BUCKET_NAME;
const S3_TOKENS_FILE = process.env.S3_TOKEN_FILE_NAME;

// SLACK configs
const appClientId = process.env.APP_CLIENT_ID;
const appClientSecret = process.env.APP_CLIENT_SECRET;
const tapiocaChannelName = 'tapioca-time';

const successTapiocaPageRedirect = process.env.SUCCESS_TAPIOCA_PAGE;
const failtTapiocaPageRedirect = process.env.FAIL_TAPIOCA_PAGE;

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
  console.log(`Getting ${S3_TOKENS_FILE} file on S3`);
  const tokenFiles = await getTokensFile();
  if (!tokenFiles) {
    throw new Error('Could not get token file');
  }
  tokenFiles.push(body);
  const params = {
    Bucket: S3_BUCKET,
    Key: S3_TOKENS_FILE,
    Body: JSON.stringify(tokenFiles),
    ContentType: 'application/json',
  };
  console.log(`Saving new ${S3_TOKENS_FILE} file with new Slack token on S3`);
  const uploadResult = await s3.upload(params).promise();
  return uploadResult;
};

exports.handler = async (event, context, callback) => {
  console.log('Request received to register Slack workspace on app');
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
    const tokensData = {
      accessToken: body.access_token,
      teamId: body.team.id,
    };
    try {
      const channelReqData = await slack.conversations.create({ name: tapiocaChannelName });
      if (!channelReqData.ok) {
        throw new Error('could not create channel');
      }
      tokensData.channelId = channelReqData.channel.id;
    } catch (error) {
      const channelsListReqData = await slack.channels.list();
      if (!channelsListReqData.ok) {
        throw new Error('could not list channels');
      }
      const channel = channelsListReqData.channels.find((c) => c.name === tapiocaChannelName);
      if (!channel) {
        throw new Error('could not find donut channel');
      }
      tokensData.channelId = channel.id;
    }
    await putToTokensFile(tokensData);
    const response = {
      statusCode: 301,
      headers: {
        Location: successTapiocaPageRedirect,
      }
    };
    return callback(null, response);
  } catch (error) {
    console.error('ERROR', error);
    console.error('ERROR MESSAGE', error.message);
    const response = {
      statusCode: 500,
      headers: {
        Location: failtTapiocaPageRedirect,
      }
    };
    return callback(null, response);
  }
};
