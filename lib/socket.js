var SocketIo = require('socket.io');
var os = require('os');
var uuid = require('node-uuid');
var configs = require('../config');

var module;
/**
 * 建立 socket
 */
exports = module.exports = function (server) {

    var p2pSocketWaiting = [];
    var roomMap = {};

    var io = SocketIo(server);
    io.set('log level', 3);

    // 建立连接的时候
    io.on('connection', function (socket) {
        // 网页打开，开始建立连接，并且绑定事件
        console.log(socket.id + "打开网页创建连接");

        // leave 离房事件
        socket.on('leave', function (data) {
            console.log(socket.id + "离开房间" + data.roomId);
            if (!data.roomId || !roomMap.hasOwnProperty(data.roomId))
                return;

            _leaveRoom_(data.roomId, socket);

            // 发送成功退房的消息
            socket.emit('left', {
                roomId: data.roomId
            })
        });

        // join 开房事件
        socket.on('join', function () {
            console.log(socket.id + "想加入聊天");
            if (socket.rooms.length > configs.userConf.maxRoomCount) {
                return;
            }
            // 1. 看看有没有待连接的，没有的话就放进去
            if (p2pSocketWaiting.length == 0) {
                p2pSocketWaiting.push(socket);
                console.log(socket.id + "被放到队列里面");
                return;
            }
            // 2. 特殊情况
            var anotherSocket = p2pSocketWaiting.pop();
            if (anotherSocket.id == socket.id) { // 慢着，有点什么不对！得排除掉自己！
                return; // 继续等吧
            }
            var roomId = socket.id > anotherSocket.id ? anotherSocket.id + socket.id : socket.id + anotherSocket.id;
            if (roomMap.hasOwnProperty(roomId)) { // 这两个人已经开房了！
                p2pSocketWaiting.push(socket);
                p2pSocketWaiting.push(anotherSocket);
                return;
            }

            // 3. 走到这一步，终于要开房聊天了…
            console.log(anotherSocket.id + "从队列里面拿出来准备聊天");
            socket.join(roomId);
            anotherSocket.join(roomId);
            roomMap[roomId] = [socket, anotherSocket];

            // 4. 发送成功开房的消息
            var members = []
            for (var i in roomMap[roomId]) {
                var member = {
                    id: roomMap[roomId][i].id,
                    nickname: roomMap[roomId][i].name || '陌生人',
                    face: roomMap[roomId][i].face || configs.front.randomFace,
                    desc: roomMap[roomId][i].desc || configs.front.defaultDesc
                };
                members.push(member);
            }
            for (var i in roomMap[roomId]) {
                roomMap[roomId][i].emit('joined', {
                    roomId: roomId,
                    members: members
                });
            }
        });

        // send 发送消息
        socket.on('send', function (data) {
            if (!data.roomId || !roomMap.hasOwnProperty(data.roomId))
                return;
            console.log(socket.id + "发送消息，内容是" + data.content);
            socket.to(data.roomId).emit('receive', {
                roomId: data.roomId,
                content: data.content,
                time: getTime(),
                sender: {
                    id: socket.id,
                    nickname: socket.nickname || '陌生人'
                }
            });
        });

        // profile 改变个人资料
        socket.on('profile', function (data) {
            if (!data)
                return;
            console.log(socket.id + '改变个人资料' + data.face + ',' + data.nickname);
            socket.nickname = data.nickname || '陌生人';
            socket.face = data.face || configs.front.faviconUrl;
            socket.desc = data.desc || configs.front.defaultDesc;
            socket.rooms.forEach(function (roomId) {
                socket.to(roomId).emit('profiled', {
                    id: socket.id,
                    nickname: socket.nickname,
                    face: socket.face,
                    desc: socket.desc
                });
            });
        });

        // disconnect 关闭网页
        socket.on('disconnect', function () {
            console.log(socket.id + "关闭了网页");
            for (var i in socket.rooms) {
                _leaveRoom_(socket.rooms[i], socket);
            }
        });

        function _leaveRoom_(roomId, socket) {
            // 1. 发送消息给该房间其他人
            socket.to(roomId).emit('notice', {
                roomId: roomId,
                content: socket.id + '已经离开',
                time: getTime(),
                sender: '通知'
            });

            // 2. 它自己离开房间，房间名单也开除他
            socket.leave(roomId);
            if (!roomMap.hasOwnProperty(roomId))
                return;
            var socketsInRoom = roomMap[roomId];
            var index = socketsInRoom.indexOf(socket);
            socketsInRoom.splice(index, 1);

            // 3. 检查是不是该房间只有一个人了，是的话要自动断开
            if (socketsInRoom.length == 1) {
                socketsInRoom[0].leave(roomId);
                socketsInRoom[0].emit('left', {
                    roomId: roomId
                });
                delete roomMap[roomId];
            }
        }

    })
};

function getTime() {
    return (new Date(os.uptime())).toTimeString().split(' ')[0];
}