# tapioca
**tapioca** is a [slack](https://slack.com/) [app](https://api.slack.com/start), that will make conversation groups with
 random people inside your 
organization and suggest something to talk about!

## How to use it? (for users)

Just enter on https://www.yuca.live/tapioca/ and press on **Add Tapioca to Slack** and follow instructions.
This will create a new channel named **tapioca-time**. Then you can invite people to join the channel. 
**tapioca** will take care of the rest, making groups with folks to talk and suggesting topics to them talk about.


## How to deploy or make a clone of it? (for devs)

If you want, you can keep using the version hosted by [Yuca](https://www.yuca.live/),
but if you want to deploy your own version of **tapioca** app, it will require you to make a new 
[Slack App](https://api.slack.com/start) and   
[Amazon Web Services](https://aws.amazon.com/) account to run for now.

The only required service so far is the [S3](https://aws.amazon.com/s3/) that is where it stores the **slack**'s oauth 
tokens.

We suggest to deploy using [Lambda](https://aws.amazon.com/lambda/) with 
[API Gateway](https://aws.amazon.com/api-gateway/) as we did.

It will require two lambda functions:

#### 1. `oauthLambda.js`
 This function will receive the Oauth hook from **slack** and save workspace token to be used later.
 As Trigger for this lambda add an API Gateway endpoint, and save this URL on your slack app webhook. 
#### 2. `tapiocaLambda.js` 
 This function will require some kind of scheduled run, we use a CloudWatch Events/EventBridge, that is a CRON 
 to schedule when it should run. We use: `cron(30 20 ? * WED *)`

## How to build and run it?
First things first, if you will use Lambda to deploy it, we suggest you to install and use 
[SAM](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/what-is-sam.html) to test it 
in your local machine:

##### For Gnu/Linux with python/pip:
```bash
pip install -U pip setuptools
```

##### For Mac OS:
```bash
brew install aws/tap/aws-sam-cli
```

Then with SAM installed you can trigger events to test like a real **AWS Lambda** call.
 
You will need to get an Oauth code from **slack**, that you can get when you give give access to the application to your
workspace, replace this code on `events/event.json`, on `queryStringParameters` on `code`, unfortunately that token is 
for a single use only, so you will need to get a new one every time you run locally.

Then to test, the group creation and token saving, run inside **tapioca** folder:
```bash
sam local invoke "Oauth" --event events/event.json
```

And then to trigger conversation making run:

```bash
sam local invoke "Tapioca"
```                       
Then you run conversation making lambda, if everything works as they should, you have the **tapioca-time** channel on
your **slack** you must see a new conversation with you and other friends who also are in the channel.                  


##### Required ENV vars
 - `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY`: if you need help to get those values: 
        [AWS: Understanding and Getting Your Security Credentials](https://docs.aws.amazon.com/general/latest/gr/aws-sec-cred-types.html).
 - `S3_BUCKET_NAME`: the name of bucket **tapioca** will use to save your files.
 - `S3_TOKEN_FILE_NAME`: the name of the file inside the `S3_BUCKET_NAME` that will hold the **slack** oauth token.
 - `APP_CLIENT_ID` and `APP_CLIENT_SECRET`: are your **slack** app client_id and secret.
        You get these values when you create your **slack app**, check 
        [Create a Slack app and authenticate with Postman](https://api.slack.com/tutorials/slack-apps-and-postman)
 - `SUCCESS_TAPIOCA_PAGE`: the redirect url of success page.
 - `FAIL_TAPIOCA_PAGE`: the redirect url in case some error happens.


### Building

There is a script called `build.sh` that will assembly two ZIP files so you can upload on **AWS Lambda**, one for **Oauth** 
and other for **Tapioca**.

# Contributing
If you want to make this tool even more awesome, please check [CONTRIBUTING](CONTRIBUTING.md) before start. 

# License
We use [MIT License](https://choosealicense.com/licenses/mit/) and any contribution to this project will automatically accept this license. 

Please, check our [LICENSE](LICENSE.txt) file for more information.
