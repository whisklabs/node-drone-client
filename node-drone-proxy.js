var arDrone = require('ar-drone');
var autonomy = require('ardrone-autonomy');
var arDroneConstants = require('ar-drone/lib/constants');

var Pusher = require("pusher");

var pusher = new Pusher({
  appId: '53075',
  key: 'c84dcb73872041ad435f',
  secret: 'e50f67b2699e4d34af97'
});

var redis = require("redis");
var client = redis.createClient(9443, "jack.redistogo.com");
client.auth("44097e3f7131e73fcd47fdc028a63f88");

client.subscribe("channel");

var arClient = arDrone.createClient();

var controller = new autonomy.Controller(arClient, {debug: false});

//var mission = autonomy.createMission(arClient, controller, {});

var droneOp = function(data, callback) {
  console.log("Received message:", data);
	callback();
  console.log("Ran callback");
}

var basicSuccess = function(data) {
  console.log("Processed message", data);
  pusher.trigger('test_channel', 'my_event', {
    "message": data.body.action,
    "message-id": data['message-id']
  });
  console.log("Pushed message", data);
}

var DEFAULT_DISTANCE = 1;
var DEFAULT_ROTATION = 45;
var DEFAULT_DURATION = 100;
var DEFAULT_ANIMATION = "wave";

var distanceOrDefault = function(data) {
  return (data && data.body && data.body.distance) || DEFAULT_DISTANCE;
}

var angleOrDefault = function(data) {
  return (data && data.body && data.body.rotation) || DEFAULT_ROTATION;
}

var durationOrDefault = function(data) {
  return (data && data.body && data.body.duration) || DEFAULT_DURATION;
}

var animationOrDefault = function(data) {
  return (data && data.body && data.body.animation) || DEFAULT_ANIMATION;
}

var rawDispatch = function(channel, rawData) {
  return dispatch(channel, JSON.parse(rawData));
}

var dispatch = function(channel, data) {  
  var success = function() { basicSuccess(data) };
  switch(data.body.action) {
    // basics
    case "takeoff":
      droneOp(data, function() {
        arClient.takeoff();
        controller.zero();
        success();
      });
      break;
    case "hover":
      droneOp(data, function() {
        controller.hover();
        success();
      });
      break;
    case "land":
      droneOp(data, function() {
        arClient.land();
        success();
      });
      break;
    // rotation
    case "clockwise":
      droneOp(data, function() {
        controller.cw(angleOrDefault(data), success);
      });
      break;
    case "anticlockwise":
      droneOp(data, function() {
        controller.ccw(angleOrDefault(data), success);
      });
      break;
    // translation
    case "right":
      droneOp(data, function() {
        controller.right(distanceOrDefault(data), success);
      });
      break;
    case "left":
      droneOp(data, function() {
        controller.left(distanceOrDefault(data), success);
      });
      break;
    case "forward":
      droneOp(data, function() {
        controller.forward(distanceOrDefault(data), success);
      });
      break;
    case "backward":
      droneOp(data, function() {
        controller.backward(distanceOrDefault(data), success);
      });
      break;
    case "altitude":
      droneOp(data, function() {
        controller.altitude(distanceOrDefault(data), success);
      });
      break;
    // timed events
    case "hover":
      droneOp(data, function() {
        controller.hover();
        success();
      });
      break;
    // animations
    case "animate":
      droneOp(data, function() {
        arClient.animate(animationOrDefault(data), durationOrDefault(data));
        success();
      });
      break;
    case "plan":
      droneOp(data, function() {
        runSafely(buildMission(data.body.steps));
      });
      break;
    case "resetEmergency":
      droneOp(data, function() {
        runSafely(buildMission(data.body.steps));
      });
      break;
    default: 
      console.log("bad message", data);
  }
}

var runSafely = function(mission) {
  mission.run(function (err, result) {
    if (err) {
        console.trace("Oops, something bad happened: %s", err.message);
        mission.client().stop();
        mission.client().land();
    } else {
        console.log("Mission success!");
        //mission.client().stop();
        //mission.client().land();
    }
  });
}

var buildMission = function(steps) {
  mission._steps = [];
  steps.forEach(function(step) {
    mission = addMissionStep(mission, step);
  })
  return mission;
}

var addMissionStep = function(mission, step) {
  console.log("Adding step", step)
  switch(step) {
    case "takeoff":
      console.log("Taking off!")
      return mission.takeoff().zero();
      break;
    case "zero":
    case "land":
      return mission[step]();
      break;
    case "altitude":
    case "forward":
    case "backward":
    case "left":
    case "right":
      console.log("Going sw!", step)
      return mission[step](DEFAULT_DISTANCE);
      break;
    case "cw":
    case "ccw":
      return mission[step](DEFAULT_ROTATION);
      break;
    case "hover":
      return mission[step](DEFAULT_DURATION);
      break;
    default:
      console.log("Seriously, this is not a step: ", step)
      return mission;
  }
}

client.on('message', rawDispatch);