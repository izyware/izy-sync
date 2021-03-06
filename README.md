# izy-sync
This tools is a Node.js universal data sync components for importing and exporting data in and out of the Izyware Cloud.

It works with the AI data extraction utility.

# INSTALLATION

If you are using npm (the Node.js package manager) always ensure that your npm is up-to-date by running:

`npm update -g npm`

Then use:

```
npm install izy-sync;cp -r node_modules/izy-sync/* .;rm -rf node_modules/izy-sync;
```

# Commandline Usage

## IMAP Server Sync

Many services support the IMAP protocol. The IMAP protocol allows for querying via the 'SEARCH' command (see https://tools.ietf.org/html/rfc3501#page-49).

You may pass on the protocol specific data via the Izy command line configurations:

```
imap.search.key1 ALL imap.search.key2 SINCE imap.search.key3 SINCE 'June 24, 2016'
```


Below are a few common service provider specific examples.

### Gmail

```
node cli.js method imap imap.user me@gmail.com imap.password mypass imap.host imap.gmail.com imap.port 993 imap.tls true mimestore.modhandler localfs mimestore.path /tmp/izyware/mimestore imap.search.key1 ALL imap.search.key2 SINCE imap.search.key3 '2010/01/01'
```

### GoDaddy

NOTE: By default GoDaddy only supports POP3.  Only unlimited Email plan supports IMAP.

```
node cli.js method imap imap.user me@email.com imap.password mypass imap.host  imap.secureserver.net imap.port 993 imap.tls true mimestore.modhandler localfs mimestore.path /tmp/izyware/mimestore imap.search.key1 ALL imap.search.key2 SINCE imap.search.key3 '2010/01/01'
```

## API Based Mailbox Access
You may also access items through the Google gmail apis:

```
node cli.js method gapi gapi.query before:2018/01/01,after:2017/01/01 gapi.sessionfilepath /tmp/izyware/sessionfile/1.txt mimestore.modhandler localfs mimestore.path /tmp/izyware/mimestore
```

You can specify query after:2016/01/01

### Notes about session tokens and API limitations

#### Grabbing the Session Data

* go to https://developers.google.com/apis-explorer/#search/messages/m/gmail/v1/gmail.users.messages.list?userId=me&_h=1&
* Click *authorize and execute*
* Check only [x] https://mail.google.com/
* Make sure developer console is open and you are tracking the network traffic
* Click *authorize and execute* (again)
* Cut & Parse the entire heads tab for https://content.googleapis.com/gmail/v1/users/me/messages?key=...
* Make sure each section's name (Request Headers, is present in the payload)

#### GAPI behavior
* The first time, it will ask you to pick an account and it will confirm that you want to allow GOOGLE API EXPLORER to Read, send, delete, and manage your email.
* A confirmation email is sent `Google APIs Explorer connected to your Google Account`
* Another confirmation email another security email was sent to the backup email account.
* The emails above were NOT sent for an MFA account but it they were sent for a non MFA (This is as of June 26 2017).
* Works with logged-in and MFA enabled (no further MFA verification)
* The data download is not throttled by size.
* The session cookie expires after about an hour or so (not predictable)
* The download rate is about 400MB/hour

## Copying Between Mime Repositories

```
node cli.js method copy source.type emlfolder source.commitmode true sourece.id xxxx source.path /izy-sync/samplestorage destination.type rawemail destination.dataservice https://yourdomain.com/apps/izyware/ destination.accesstoken xxxx destination.groupid 1
```

## Query Mime Repository Database

The interface supports SQL compliant queries:

```
node cli.js method querymimerepo dataservice https://yourdomain.com/apps/izyware/ accesstoken xxxx query 'select id, readBy, channel, channelId, sender, senderId from db.messageextract where body = "body"  limit 1'
```

If you are dealing with a file based repository, you can get the oldest date by:

```
grep Date  \`ls -l -r | tail -n 1 | cut -c 52-71\`
```

remove -r from ls to get the newst date

## NOTE
for more details, visit https://izyware.com
