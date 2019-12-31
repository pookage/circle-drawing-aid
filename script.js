window.addEventListener("DOMContentLoaded", init);


//////////////////////////
// INITIALISATION --------
//////////////////////////
function init(){

	// create and configure canvas
	const { canvas, context } = initCanvas();

	// create an app state
	const state = {
		drawing: false,
		lastPosition: {},
		max: Math.min(canvas.width, canvas.height),
		path: []
	};

	// bind all the functions as needed
	const handleDrawStart  = startDraw.bind(true, state);
	const handleDrawEnd    = endDraw.bind(true, state, context, canvas);
	const handleDrawUpdate = draw.bind(true, state, context, canvas);

	// add listeners for relative mouse events
	// NOTE: there's a bug in chromium browsers that has buggy detection with a stylus
	initListeners(canvas, {
		"pointerdown":  handleDrawStart,
		"pointerup":    handleDrawEnd,
		"pointermove":  handleDrawUpdate,
	});

	// create initial circle
	const target = generateCircle(state, context, canvas);
	state.target = target;

	// start it up
	document.body.appendChild(canvas);
	drawCircle(context, target);

}// init

function initCanvas(){
	const canvas  = document.createElement("canvas");
	const context = canvas.getContext("2d");
	const { innerWidth, innerHeight } = window;

	canvas.width     = innerWidth;
	canvas.height    = innerHeight;
	canvas.className = "canvas";

	context.strokeStyle = "#111111";
	context.lineJoin    = "round";
	context.lineWidth   = 2;

	return { canvas, context };
}// initCanvas

function initListeners(element, actions){
	for(let [ event, callback ] of Object.entries(actions)){
		element.addEventListener(event, callback);
	}
}// initListeners


//////////////////////////
// LIFECYCLE -------------
//////////////////////////
function generateCircle(state, context, canvas){

	// circle config
	const { max } = state;
	const min     = max * 0.1;
	const radius  = (random(min, max) / 2) * 0.9;

	// position config
	const {
		innerWidth,
		innerHeight
	} = window;

	const x = (innerWidth / 2);
	const y = (innerHeight / 2);

	return {
		x, y, 
		radius
	};
}// generateCircle




//////////////////////////
// EVENT HANDLING --------
//////////////////////////
function startDraw(state, event){
	console.log("start!")

	event.preventDefault();

	state.drawing = true;
	state.path    = [];
}// startDraw

function endDraw(state, context, canvas, event){

	console.log("end!")

	event.preventDefault();

	const { width, height } = canvas;
	const { path, target }  = state;

	// start fresh
	context.clearRect(0, 0, width, height);

	// const score = compare(context, target, path, "source-atop");

	const userInput   = drawPath.bind(true, context, path);
	const targetInput = drawCircle.bind(true, context, target);

	// determines how too far IN you are (black is bad)
	const score = compare(
		userInput.bind(true, "#FFFFFF"),
		targetInput.bind(true, "#000000"),
	);


	// capture the current state of the image
	const capture = context.getImageData(0, 0, width, height);
	const { data: pixelData } = capture;

	for(let index = 3; index < pixelData.length; index += 4){
		const r = pixelData[index - 3];
		const g = pixelData[index - 2];
		const b = pixelData[index - 1];

		const isWhite = r === 255 && g === 255 && b === 255;

		// if(isWhite) pixelData[index] = 0;
	}

	capture.data = pixelData;

	const captureCanvas  = document.createElement("canvas");
	const captureContext = captureCanvas.getContext("2d");
	captureCanvas.width  = width;
	captureCanvas.height = height;
	document.body.appendChild(captureCanvas)

	captureContext.putImageData(capture, 0, 0);
	const captureImgData = captureCanvas.toDataURL();
	const captureImg     = new Image();

	captureImg.src = captureImgData;
	context.clearRect(0, 0, width, height);

	console.log(captureImg)
	// determines how too far OUT you are (black is bad)
	const scoreb = compare(
		targetInput.bind(true, "#FFFFFF"),
		userInput.bind(true, "#000000"),
	);

	context.drawImage(captureImg, 0, 0, width, height);


	/*
		TODO:
			1. convert 'white' to 'transparent'
			2. combine the two diffs into one
			3. redraw target circle (to calculate area / circumfrence?)
			4. get # of black pixels as ratio of circle area (maybe circumfrence?)
			5. report 

			
			NOTE: maybe a better way to do this is to draw a ring and test diff with that instead?
			NOTE: current method allows us to see if more pixels on outer or inenr to say "too big!" or "too small!"
	*/

	// reset
	state.drawing      = false;
	state.lastPosition = {};
}// endDraw

function requestDraw(...args){

	requestAnimationFrame(draw.bind(true, ...args))
}// requestDraw

function draw(state, context, canvas, event){

	event.preventDefault();

	const {
		drawing,
		lastPosition,
		path: existingPath
	} = state;

	if(drawing){
		const {
			clientX: x,
			clientY: y
		} = event;

		const {
			width,
			height
		} = canvas;

		const {
			x: lastX,
			y: lastY
		} = lastPosition;

		if(lastX && lastY){

			context.beginPath();

			// create a new path
			const path = new Path2D();

			// draw the portion
			path.moveTo(lastX, lastY);
			path.lineTo(x, y);
			path.closePath();

			// fill it so it's visible
			context.stroke(path);

			// add to the state so that we can use it later
			existingPath.push({ x, y });
		}


		state.lastPosition.x = x;
		state.lastPosition.y = y;
	}
}// draw


//////////////////////////
// UTILS -----------------
//////////////////////////
function random(min, max){

	return Math.floor(Math.random() * (max - min + 1) + min);
}// random

function drawCircle(context, { x, y, radius }, color = "#DDDDDD", overlap = "source-over"){


	context.globalCompositeOperation = overlap;

	context.beginPath();
	context.moveTo(x, y);
	context.arc(x, y, radius, 0, Math.PI * 2)
	context.closePath();

	context.fillStyle = color;            
	context.fill();
}// drawCircle

function drawPath(context, path, color = "#000000", overlap = "source-over" ){

	context.beginPath();

	context.globalCompositeOperation = overlap;

	for(let index in path){
		const { x, y } = path[index];

		if(index === 0) context.moveTo(x, y);
		else            context.lineTo(x, y);
	}

	context.closePath();

	context.fillStyle = color;
	context.fill()
}// drawPath

function compare(drawSource, drawTarget){

	drawTarget("source-over");
	drawSource("source-atop");

}// compare