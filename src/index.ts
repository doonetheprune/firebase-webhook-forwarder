#!/usr/bin/env node
import {existsSync} from 'fs';
import yargs from 'yargs';
import {hideBin} from 'yargs/helpers';
import * as admin from "firebase-admin";
import * as path from "node:path";
import axios from "axios";

const argv = yargs(hideBin(process.argv))
    .option('url', {
        describe: 'Url to Forward Requests',
        type: 'string',
        alias: 'u'
    })
    .option('webhookName', {
        describe: 'Id for receiving the webhook',
        type: 'string',
        alias: 'w',
    })
    .option('fireStoreCollection', {
        describe: 'Id for receiving the webhook',
        type: 'string',
        alias: 'c',
        default: 'requests'
    })
    .option('secretsFile', {
        describe: 'Path to the secrets file',
        type: 'string',
        alias: 's'
    })
    .option('requestId', {
        describe: 'Reply Single Request',
        type: 'string',
        alias: 'r'
    })
    .help()
    .alias('help', 'h')
    .parseSync();

const secretsPath = path.join(__dirname, argv.secretsFile || '');

const forwardRequest = async (docId: string, requestData: Record<string, any>) => {
    console.log("Sending Request:", docId, requestData);

    // Construct the Axios request based on the Firestore document data
    axios({
        method: requestData.method,
        url: argv.url,
        headers: requestData.headers,
        params: requestData.query,
        data: requestData.body
    })
        .then(response => {
            console.log('Axios response:', docId, response.data);
        })
        .catch(error => {
            console.error('Axios error:', docId, error.message, error.response.data);
        });
}

(async () => {
    if (!argv.url) {
        throw new Error("No Forwarder URL provided");
    } else if (!argv.secretsFile || !existsSync(secretsPath)) {
        // @ts-ignore
        console.log(secretsPath, existsSync(secretsPath));
        throw new Error("No secrets file provided or it doesn't exist " + secretsPath);
    }

    const serviceAccount = require(secretsPath);

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });

    const firestore = admin.firestore();


    if (argv.requestId) {
        const docRef = firestore.collection(argv.fireStoreCollection).doc(argv.requestId);
        const docSnapshot = await docRef.get();
        const requestData = docSnapshot.data();

        if (!docSnapshot.exists || !requestData) {
            console.log(`No request found with ID: ${argv.requestId}`);
            return;
        } else {
            await forwardRequest(argv.requestId, requestData)
        }
    } else {
        console.log('Listening for Changes on the Firestore');

        firestore.collection(argv.fireStoreCollection)
            .orderBy("dateAdded", "desc")
            .where("dateAdded", '>=', new Date())
            .where("webhookName", '==', argv.webhookName)
            .onSnapshot(snapshot => {
                snapshot.docChanges().forEach(change => {
                    const requestData = change.doc.data();
                    forwardRequest(change.doc.id, requestData)
                });
            });
    }


})();
