let video = document.getElementById("videoInput");

let streaming = false;
let isCanvasReady = false;

const width = video.width;
const height = video.height;

let counter = 0;

let src = null;
let gray = null;
let faces = null;
let eyes = null;
let faceCascade = null;
let eyeCascade = null;
let previousWidth = 0;
let previousHeight = 0;

let leftX = null;
let leftY = null;
let rightX = null;
let rightY = null;

const checkVariable = v => v !== undefined && v !== null;

Module.onRuntimeInitialized = () => {
  console.log("[videoWorker] cv:", cv);
  console.log("[videoWorker] Module:", Module);

  if (!checkVariable(faceCascade)) {
    faceCascade = new cv.CascadeClassifier();
    const faceCascadeLoaded = faceCascade.load("face.xml");

    console.log({ faceCascadeLoaded });
  }

  if (!checkVariable(eyeCascade)) {
    eyeCascade = new cv.CascadeClassifier();
    const eyeCascadeLoaded = eyeCascade.load("eye.xml");

    console.log({ eyeCascadeLoaded });
  }

  main();
};

Module.preRun = [
  () => {
    Module.FS_createPreloadedFile(
      "/",
      "face.xml",
      "cascade/haarcascade_frontalface_default.xml",
      true,
      false
    );
    Module.FS_createPreloadedFile(
      "/",
      "eye.xml",
      "cascade/haarcascade_eye.xml",
      true,
      false
    );
  }
];

const processFrame = (srcData, width, height) => {
  src = new cv.Mat(height, width, cv.CV_8UC4);
  gray = new cv.Mat(height, width, cv.CV_8UC1);
  faces = new cv.RectVector();
  eyes = new cv.RectVector();

  const initialized =
    checkVariable(faceCascade) &&
    checkVariable(eyeCascade) &&
    checkVariable(src) &&
    checkVariable(gray) &&
    checkVariable(faces) &&
    checkVariable(eyes);

  if (initialized) {
    src.data.set(srcData);

    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    faceCascade.detectMultiScale(gray, faces, 1.1, 3, 0);

    let rects = {
      left: null,
      right: null
    };

    for (let i = 0; i < faces.size(); i++) {
      const faceRect = faces.get(i);
      const faceX = faceRect.x;
      const faceY = faceRect.y;
      const faceWidth = faceRect.width;
      const faceHeight = faceRect.height;

      let roiGray = gray.roi(faceRect);

      eyeCascade.detectMultiScale(roiGray, eyes);

      for (let j = 0; j < eyes.size(); j++) {
        const eyeRect = eyes.get(j);
        const eyeX = eyeRect.x;
        const eyeY = eyeRect.y;
        const eyeWidth = eyeRect.width;
        const eyeHeight = eyeRect.height;

        if (eyeY + eyeHeight / 2 < faceHeight / 2) {
          if (eyeX + eyeWidth / 2 < faceWidth / 2) {
            rects.left = {
              x: faceX + eyeX,
              y: faceY + eyeY,
              width: eyeWidth,
              height: eyeHeight
            };
          } else {
            rects.right = {
              x: faceX + eyeX,
              y: faceY + eyeY,
              width: eyeWidth,
              height: eyeHeight
            };
          }
        }
      }
    }

    src.delete();
    gray.delete();
    faces.delete();
    eyes.delete();

    return rects;
  }
};

const main = () => {
  navigator.mediaDevices
    .getUserMedia({ video: true, audio: false })
    .then(function(stream) {
      video.srcObject = stream;
      video.play();
    })
    .catch(function(err) {
      console.log("An error occurred! " + err);
    });

  let canvasFrame = document.getElementById("canvasFrame");
  let context = canvasFrame.getContext("2d");

  const processVideo = () => {
    try {
      const start = performance.now();

      const srcData = context.getImageData(0, 0, width, height).data;

      context.drawImage(video, 0, 0, width, height);

      const features = processFrame(srcData, width, height);

      const leftX = features.left ? features.left.x : null;
      const leftY = features.left ? features.left.y : null;
      const rightX = features.right ? features.right.x : null;
      const rightY = features.right ? features.right.y : null;

      const end = performance.now();

      document.getElementById("fps").textContent =
        Math.round((1000 / (end - start)) * 10) / 10;
      document.getElementById("ms").textContent = end - start;

      document.getElementById("leftEyeX").textContent = leftX;
      document.getElementById("leftEyeY").textContent = leftY;
      document.getElementById("rightEyeX").textContent = rightX;
      document.getElementById("rightEyeY").textContent = rightY;

      requestAnimationFrame(processVideo);
    } catch (err) {
      console.log(err);
    }
  };

  requestAnimationFrame(processVideo);
};
