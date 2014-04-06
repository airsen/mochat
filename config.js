/**
 * config file
 *
 */

var path = require('path');

exports = module.exports = {

    dbc: {
        host: 'localhost',
        db: 'chatnow',
        port: '27017',
        username: '',
        password: '',
        auto_reconnect: true,

        /*用于程序启动时，数据库自检*/
        collections_count: 1,
        indexes_count: 0
    },

    front: {
        faviconUrl: 'http://cl.man.lv/favicon.ico',//'http://www.morewords.com/favicon.ico',
        randomFace: 'http://avatar.3sd.me/40'
    },

    userConf: {
        maxRoomCount: 5
    },

    roomConf: {

    }


}