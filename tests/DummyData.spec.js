const Dummy = {};

Dummy.keyPairs = [
    Uint8Array.from([80, 7, 223, 74, 180, 87, 45, 92, 58, 48, 191, 113, 43, 214, 34, 55, 46, 122, 72, 11, 107, 8, 65, 241, 115, 92, 130, 175, 241, 185, 169, 183, 174, 240, 89, 117, 196, 43, 7, 3, 130, 246, 113, 202, 84, 220, 251, 37, 3, 182, 154, 165, 108, 133, 97, 30, 130, 234, 187, 247, 131, 30, 69, 167, 0]),
    Uint8Array.from([104, 45, 240, 53, 195, 14, 140, 85, 189, 164, 171, 81, 114, 19, 121, 44, 42, 244, 180, 233, 194, 58, 194, 207, 17, 189, 40, 178, 55, 166, 84, 78, 10, 155, 85, 66, 13, 54, 100, 153, 104, 0, 241, 212, 143, 86, 131, 206, 217, 182, 102, 111, 215, 208, 158, 97, 100, 24, 38, 241, 119, 53, 9, 128, 0])
];

/** @type {Uint8Array[]} */
Dummy.encryptedKeyPairs = [
    Uint8Array.from([1, 8, 80, 150, 186, 189, 150, 57, 79, 96, 174, 78, 223, 117, 169, 132, 238, 229, 139, 198, 26, 51, 200, 110, 40, 211, 7, 197, 254, 39, 242, 13, 167, 19, 206, 206, 8, 216, 250, 113, 64, 171, 120, 143, 138, 32, 195, 84, 31, 34, 72, 255, 234, 219]),
    Uint8Array.from([1, 8, 24, 177, 11, 62, 7, 45, 78, 82, 57, 62, 128, 34, 23, 77, 125, 10, 45, 7, 135, 141, 240, 159, 197, 49, 42, 107, 14, 182, 199, 69, 179, 204, 69, 17, 44, 239, 203, 229, 145, 248, 38, 189, 191, 3, 25, 127, 78, 140, 102, 201, 51, 229])
];

/** @type {string} */
Dummy.encryptionPassword = 'password';

/** @type {KeyInfo[]} */
Dummy.keyInfo = [
    {
        userFriendlyAddress: 'NQ02 93YX MNVP HYHK 2N12 BM6B QGFG PAEN 2F55',
        type: /** @type {EncryptionType} */ (2)
    },
    {
        userFriendlyAddress: 'NQ71 CT4K 7R9R EHSB 7HY9 TSTP XNRQ L2RK 8U4U',
        type: /** @type {EncryptionType} */ (1)
    }
];

/** @type {KeyEntry[]} */
Dummy.keyDatabaseEntries = [
    Object.assign({}, Dummy.keyInfo[0], {encryptedKeyPair: Dummy.encryptedKeyPairs[0]}),
    Object.assign({}, Dummy.keyInfo[1], {encryptedKeyPair: Dummy.encryptedKeyPairs[1]})
];

/** @type {AccountInfo[]} */
Dummy.deprecatedAccountInfo = Dummy.keyInfo.map((keyInfo, i) => ({
    userFriendlyAddress: keyInfo.userFriendlyAddress,
    type: keyInfo.type === EncryptionType.LOW ? 'low' : 'high',
    label: `Dummy account ${i}`
}));

/** @type {AccountEntry[]} */
Dummy.deprecatedAccountDatabaseEntries = [
    Object.assign({}, Dummy.deprecatedAccountInfo[0], {encryptedKeyPair: Dummy.encryptedKeyPairs[0]}),
    Object.assign({}, Dummy.deprecatedAccountInfo[1], {encryptedKeyPair: Dummy.encryptedKeyPairs[1]})
];

Dummy.keyInfoCookieEncoded = '2SP/q27eP4zFYIl1MvEHwup1hPKU1Zskz5Tl0dLPH6d63f1s4oLM0cJw';

/** @type {string} */
Dummy.cookie = `k=${Dummy.keyInfoCookieEncoded};accounts=${JSON.stringify(Dummy.deprecatedAccountInfo)};some=thing;`;

/**
 * @param {IDBDatabase} db
 * @param {string} objectStoreName
 * @param {object} entry
 * @returns {Promise.<void>}
 */
Dummy.addEntryToDataBase = async function(db, objectStoreName, entry) {
    return new Promise((resolve, reject) => {
        const putTx = db.transaction([objectStoreName], 'readwrite')
            .objectStore(objectStoreName)
            .put(entry);
        putTx.onsuccess = () => resolve(putTx.result);
        putTx.onerror = reject;
    });
};

Dummy.createDummyAccountStore = async function() {
    // create database
    const db = await new Promise((resolve, reject) => {
        const request = window.indexedDB.open(AccountStore.ACCOUNT_DATABASE, AccountStore.VERSION++);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
        request.onupgradeneeded = () => {
            /** @type {IDBDatabase} */
            const db = request.result;
            if (db.objectStoreNames.contains(AccountStore.ACCOUNT_DATABASE)) {
                db.deleteObjectStore(AccountStore.ACCOUNT_DATABASE);
            }

            db.createObjectStore(AccountStore.ACCOUNT_DATABASE, { keyPath: 'userFriendlyAddress' });
        };
    });

    // fill database
    await Promise.all([
        Dummy.addEntryToDataBase(db, AccountStore.ACCOUNT_DATABASE, Dummy.deprecatedAccountDatabaseEntries[0]),
        Dummy.addEntryToDataBase(db, AccountStore.ACCOUNT_DATABASE, Dummy.deprecatedAccountDatabaseEntries[1])
    ]);

    db.close();
};

Dummy.createDummyKeyStore = async function() {
    const db = await new Promise((resolve, reject) => {
        const request = window.indexedDB.open(KeyStore.DB_NAME, KeyStore.DB_VERSION++);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);

        request.onupgradeneeded = () => {
            /** @type {IDBDatabase} */
            const db = request.result;
            if (db.objectStoreNames.contains(KeyStore.DB_KEY_STORE_NAME)) {
                db.deleteObjectStore(KeyStore.DB_KEY_STORE_NAME);
            }

            const store = db.createObjectStore(KeyStore.DB_KEY_STORE_NAME, { keyPath: 'userFriendlyAddress' });
            store.createIndex('by_type', 'type');
        };
    });

    db.close();

    await Promise.all([
        KeyStore.instance.putPlain(Dummy.keyDatabaseEntries[0]),
        KeyStore.instance.putPlain(Dummy.keyDatabaseEntries[1])
    ]);
};

/**
 * @param {string} dbName
 */
Dummy.deleteDatabase = async function(dbName) {
    return new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase(dbName);
        request.onerror = () => reject;
        request.onsuccess = () => resolve(`Database ${dbName} deleted`);
        request.onblocked = () => reject(new Error('Can\'t delete database, there is still an open connection.'));
    });
};

(() => {
    beforeAll(async () => {
        Nimiq.GenesisConfig.test();
        await Nimiq.WasmHelper.doImportBrowser();
    });

    afterAll(async () => {
        console.log(await Dummy.deleteDatabase(AccountStore.ACCOUNT_DATABASE));
        console.log(await Dummy.deleteDatabase(KeyStore.DB_NAME));
    });
})();
