# Firebase Webhook Forwarder

## Overview

firebase-webhook-forwarder is a very simple module designed to enable receiving webhooks in your local development environment. It subscribes to a Firestore database and listens for new webhook requests added to a Firestore collection, forwarding them to the appropriate destination.

The contents of index.ts are very simple, so for the security-paranoid, feel free to copy the index.ts and the example Firebase function directly instead of using this package.
## Features

- Listens for new webhook requests added to Firestore.
- Stores webhook data including headers, body, method, and query parameters.
- Enforces a limit on stored documents by automatically deleting the oldest records.

## Installation

To install the package, use npm:

```sh
npm install -g firebase-webhook-forwarder
```

Ensure you have Node.js and npm installed before proceeding.

## Getting Started

### Prerequisites

- Node.js (latest LTS recommended)
- Firebase CLI installed (`npm install -g firebase-tools`)
- A Firebase project with Firestore enabled

### Setting Up Firestore and Firebase Functions

#### 1. Create a Firebase Project
If you haven't already, create a Firebase project and enable Firestore:
```sh
firebase login
firebase projects:create <your-project-id>
firebase use --add <your-project-id>
```

#### 2. Initialize Firebase Functions
```sh
firebase init functions
```
- Select TypeScript when prompted.
- Enable Firestore for your project.
- Install dependencies:
  ```sh
  cd functions && npm install
  ```

#### 3. Deploy the Firebase Functions
Save the following TypeScript function in `functions/src/index.ts`:

```typescript
import {onRequest} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import express, {Request, Response} from "express";

admin.initializeApp();

const app = express();
app.use(express.json());

const MAX_DOCUMENTS = 100;

const onSend = async function(req: Request, res: Response) {
  const data = {
    webhookName: req.params.webhookName || "unknown",
    dateAdded: new Date(),
    headers: req.headers,
    query: req.query,
    body: req.body,
    method: req.method,
  };

  try {
    const collectionRef = admin.firestore().collection("requests");
    const countSnapshot = await collectionRef.count().get();
    const docCount = countSnapshot.data()?.count || 0;

    if (docCount >= MAX_DOCUMENTS) {
      const oldestDocSnapshot = await collectionRef.orderBy("dateAdded", "asc")
        .limit(1).get();

      if (!oldestDocSnapshot.empty) {
        await oldestDocSnapshot.docs[0].ref.delete();
      }
    }

    const docRef = await collectionRef.add(data);
    res.status(200).send(`Data stored with ID: ${docRef.id}`);
  } catch (error) {
    console.error("Error saving to Firestore:", error);
    res.status(500).send("Failed to store data");
  }
};

app.get("/send/:webhookName", onSend);
app.put("/send/:webhookName", onSend);
app.delete("/send/:webhookName", onSend);
app.post("/send/:webhookName", onSend);

exports.app = onRequest(app);
```

Deploy the functions:
```sh
firebase deploy --only functions
```

### Expected Output
After deploying, you should see output similar to:
```sh
i  functions: updating Node.js 22 (2nd Gen) function app(us-central1)...
✔  functions[app(us-central1)] Successful update operation.
Function URL (app(us-central1)): https://app-fjfjfjd9393-uc.a.run.app
i  functions: cleaning up build files...
⚠  functions: Unhandled error
```

Based on the above URL, you can send requests to:
```sh
https://app-fjfjfjd9393-uc.a.run.app/send/test
```

## Using `firebase-webhook-forwarder`

Once deployed, your Firebase function will be able to capture incoming webhook requests and store them in Firestore under the `requests` collection. The function supports GET, POST, PUT, and DELETE methods, forwarding webhook data into Firestore automatically.

## Running the CLI

The `firebase-webhook-forwarder` package provides a CLI tool to listen for changes and forward requests from Firestore. Here’s how to use it:

```sh
firebase-webhook-forwarder --url=https://your-forwarding-url.com --webhookName=test-webhook --secretsFile=./serviceAccount.json
```

### Options
- `--url` (`-u`): The URL where webhook requests should be forwarded.
- `--webhookName` (`-w`): Identifier for filtering incoming webhooks.
- `--fireStoreCollection` (`-c`): Firestore collection name (default: `requests`).
- `--secretsFile` (`-s`): Path to your Firebase service account credentials.
- `--requestId` (`-r`): Fetch and forward a specific request by ID.

## Contributing

If you'd like to contribute, feel free to open an issue or submit a pull request.

## License

MIT License.

