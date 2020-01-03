window.addEventListener("DOMContentLoaded", init);


//////////////////////////
// INITIALISATION --------
//////////////////////////
function init(){

	// create and configure canvas
	const { canvas, context } = initCanvas();
	const { canvas: bufferCanvas, context: bufferContext } = initCanvas();

	bufferCanvas.style.opacity = 0;


	// create an app state
	const state = {
		drawing: false,
		lastPosition: {},
		max: Math.min(canvas.width, canvas.height),
		path: [],
		allowance: 1
	};

	// bind all the functions as needed
	const handleDrawStart  = startDraw.bind(true, state, context, canvas);
	const handleDrawEnd    = endDraw.bind(true, state, context, canvas, bufferContext, bufferCanvas);
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

	// add canvases to the page
	document.body.appendChild(bufferCanvas);
	document.body.appendChild(canvas);

	// draw the initial circle on the page
	drawCircle(context, target);

}// init

function initCanvas(){
	const canvas  = document.createElement("canvas");
	const context = canvas.getContext("2d");
	const { innerWidth, innerHeight } = window;

	canvas.width     = innerWidth;
	canvas.height    = innerHeight;
	canvas.className = "canvas";

	
	context.lineCap     = "round"

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
	const {
		max, 
		min = max * 0.1 
	} = state;
	const radius = (random(min, max) / 2) * 0.9;

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
function startDraw(state, context, canvas, event){
	event.preventDefault();

	const { which: mouseButton } = event;

	switch(mouseButton){
		case 1:
			const { height }    = canvas;
			state.drawing       = true;
			state.path          = [];
			context.strokeStyle = "#000000";
			context.lineWidth   = height / 335; //3;
			break;
	}

}// startDraw

async function endDraw(state, context, canvas, bufferContext, bufferCanvas, event){

	// stop drawing the circle
	state.drawing      = false;

	event.preventDefault();

	const { which: mouseButton } = event;

	switch(mouseButton){

		// left-mouse click / main pointer click
		case 1:
			// generate score
			const { target, allowance }    = state;
			const { diff, size: diffSize } = await generateDiffComposite(state, context, canvas, bufferContext, bufferCanvas);
			const score                    = calculateScore(target, diffSize, allowance);

			// draw the coffeestain
			context.putImageData(diff, 0, 0);

			
			console.log({ score })
			// console.log({circumfrence, size: size.total, percentage: `${percentage * 100}%`})			

			break;
	}

	// reset state

	state.lastPosition = {};
	state.path         = [];

	/*
		TODO:
			1. redraw target circle & stroke with a thick border (proportionate to size? controllable via options?)
			2. use globalCompositeOperation to cut-out stroke from composite diff
			3. count the number of black pixels
			4. compare #3 with the circumfrence of the circle to generate score
			5. add user-inputs to control:
				a. size of min/max circle radius
				b. size of evaluation stroke
			6. add UI elements to show
				a. the coffee-stain diff in center
				b. percentage score
				c. 'too in' vs 'too out'
				d. graph attempt score along the bottom of the page
				e. original drawing
				f. personal best
					i. percentage
					ii. circle

			
	*/
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

			const { pressure } = event;

			// context.beginPath();

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

	// define which composite-mode to use for cutting-out
	context.globalCompositeOperation = overlap;

	// draw the circle path
	context.moveTo(x, y);
	context.beginPath();
	context.arc(x, y, radius, 0, Math.PI * 2)
	context.closePath();

	// style the circle
	context.fillStyle = color;            
	context.fill();

}// drawCircle

function drawPath(context, path, color = "#000000", overlap = "source-over" ){

	// define which composite-mode to use for cutting-out
	context.globalCompositeOperation = overlap;

	// draw the path
	context.beginPath();
	for(let index in path){
		const { x, y } = path[index];

		if(index === 0) context.moveTo(x, y);
		else            context.lineTo(x, y);
	}
	context.closePath();

	// style the path
	context.fillStyle = color;
	context.fill()
}// drawPath

function drawDiff(source, target){

	target("source-over");
	source("source-atop");
}// compare

function generateImage(state, context, canvas, bufferContext, bufferCanvas){
	return new Promise(resolve => {

		// CAPTURE & MODIFY
		// -------------------------------
		// capture the current state of the image
		const { width, height } = canvas;
		const capture = context.getImageData(0, 0, width, height);
		const { data: pixelData } = capture;

		let blackCount = 0;
		// make any white pixels transparent
		for(let index = 3; index < pixelData.length; index += 4){
			const r = pixelData[index - 3];
			const g = pixelData[index - 2];
			const b = pixelData[index - 1];
			const a = pixelData[index];

			const isBlack = r === 0 && g === 0 && b === 0;

			if(isBlack && a > 0) blackCount++
			else pixelData[index] = 0;
		}

		// draw altered data back onto the canvas
		bufferContext.putImageData(capture, 0, 0);

		console.log(pixelData)

		// SAVE
		// ----------------------------------
		// save canvas data to an image for usage later.
		const captureImgData = bufferCanvas.toDataURL();
		const captureImg     = new Image();
		captureImg.src       = captureImgData;

		// return the image once loaded
		captureImg.addEventListener("load", () => {
			bufferContext.clearRect(0, 0, width, height);
			resolve({
				diff: captureImg,
				size: blackCount
			});
		});		
	});
}// generateImage

async function generateDiffComposite(state, context, canvas, bufferContext, bufferCanvas){

	// CONFIGURATION
	// ------------------------------------
	const { width, height } = canvas;
	const { path, target }  = state;

	// start fresh
	context.clearRect(0, 0, width, height);

	//bind constant arguments to the functions to make it clearer later
	const userInput   = drawPath.bind(true, context, path);
	const targetInput = drawCircle.bind(true, context, target);


	// LET THE DIFFING COMMENCE
	// ------------------------------------
	// FIRST DIFF
	// determines how too far IN you are (black is bad)
	const score = drawDiff(
		userInput.bind(true, "#FFFFFF"),
		targetInput.bind(true, "#000000"),
	);
	const { diff: innerDiff, size: innerSize } = await generateImage(state, context, canvas, bufferContext, bufferCanvas);

	// SECOND DIFF
	// determines how too far OUT you are (black is bad)
	const scoreb = drawDiff(
		targetInput.bind(true, "#FFFFFF"),
		userInput.bind(true, "#000000"),
	);
	const { diff: outerDiff, size: outerSize } = await generateImage(state, context, canvas, bufferContext, bufferCanvas);


	// COMBINE AND GO GO GO
	// -------------------------------------
	// draw both diffs onto the same canvas
	context.drawImage(outerDiff, 0, 0);
	context.drawImage(innerDiff, 0, 0);

	// store the data of the diff somewhere safe
	const diff = context.getImageData(0, 0, width, height);

	// clear the canvas tidy again
	context.clearRect(0, 0, width, height);

	return {
		diff,
		size: {
			inner: innerSize,
			outer: outerSize,
			total: innerSize + outerSize
		}
	};
}// generateDiffComposite

function calculateScore(target, diff, allowance){

	const { radius }          = target;
	const { total: diffArea } = diff;

	const circumfrence = (radius * 2) * Math.PI;
	const percentage   = (circumfrence * (1 + allowance)) / diffArea;
	const score        = (percentage * 100).toFixed(2);

	return score;
}// calculateScore