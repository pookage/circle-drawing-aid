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
		allowance: 1,
		last: {
			score: 0,
			drawn: {},
			path: []
		},
		best: {
			score: 0,
			drawn: {},
			path: []
		},
		ui: {

			drawn: {
				last: document.getElementById("output__last_drawn"),
				best: document.getElementById("output__best_drawn"),
				optimal: document.getElementById("output__optimal_drawn"),
				labels: document.getElementsByClassName("output__label"),
				images: document.getElementsByClassName("output__drawn")
			},
			score: {
				last: document.getElementById("output__last_score"),
				best: document.getElementById("output__best_score")
			}
		}
	};
	state.restart = restart.bind(true, state, context, canvas);

	// bind all the functions as needed
	const handleDrawStart  = startDraw.bind(true, state, context, canvas);
	const handleDrawEnd    = endDraw.bind(true, state, context, canvas, bufferContext, bufferCanvas);
	const handleDrawUpdate = draw.bind(true, state, context, canvas);

	// add listeners for relative mouse events
	// NOTE: there's a bug in chromium browsers that has buggy detection with a stylus
	initListeners([ canvas ], {
		"pointerdown":  handleDrawStart,
		"pointerup":    handleDrawEnd,
		"pointermove":  handleDrawUpdate,
	});

	initListeners(state.ui.drawn.labels, {
		"mouseover": focusPreview.bind(true, state.ui.drawn.images),
		"mouseleave": blurPreview.bind(true, state.ui.drawn.images)
	});

	// create initial circle
	const target = generateCircle(state, context, canvas);
	state.target = target;

	// add canvases to the page
	document.body.appendChild(bufferCanvas);
	document.body.appendChild(canvas);

	state.restart();
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

function initListeners(elements, actions){
	for(let element of elements){
		for(let [ event, callback ] of Object.entries(actions)){
			element.addEventListener(event, callback);
		}
	}
}// initListeners


//////////////////////////
// LIFECYCLE -------------
//////////////////////////
function restart(state, context, canvas){

	const { width, height } = canvas;
	const target = generateCircle(state, context, canvas);
	state.target = target;

	context.clearRect(0, 0, width, height);
	
	// draw the initial circle on the page
	drawCircle(context, target);
}// restart
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
			// state.path          = [];
			context.strokeStyle = "#000000";
			context.lineWidth   = height / 335; //3;
			clearTimeout(state.endTimeout);
			break;
	}
}// startDraw

function focusPreview(previews, event){

	const { htmlFor: targetId } = event.target;
	// const preview     = previews.getElementById(htmlFor);

	for(let preview of previews){
		const { id } = preview;
		if(id === targetId) preview.classList.add("output__drawn--active");
		else                preview.classList.add("output__drawn--inactive");
	}

}// focusPreview

function blurPreview(previews, event){
	for(let preview of previews){
		preview.classList.remove("output__drawn--active");
		preview.classList.remove("output__drawn--inactive");
	}
}// blurPreview

async function endDraw(state, context, canvas, bufferContext, bufferCanvas, event){

	event.preventDefault();
	state.drawing      = false;
	clearTimeout(state.endTimeout);

	state.endTimeout = setTimeout(async () => {
		const { which: mouseButton } = event;

		switch(mouseButton){

			// left-mouse click / main pointer click
			case 1:
				// generate score
				const {
					path, 
					target, 
					allowance,
					last: { 
						score: lastScore,
						drawn: lastDrawn,
						path: lastPath
					},
					best: {
						score: bestScore,
						drawn: bestDrawn,
						path: bestPath
					}
				} = state;
				const { diff, size: diffSize } = await generateDiffComposite(state, context, canvas, bufferContext, bufferCanvas);
				const score                    = calculateScore(target, diffSize, allowance);
				const last = {
					score,
					drawn: diff,
					path: [ ...path ],
					target: state.target
				};



				// if the score is better than the last; save it as the best
				if(score > bestScore){
					console.log(`${score} is better than ${bestScore} - UPDATING BEST!`);
					state.best = {
						score,
						drawn: diff,
						path: [ ...path ],
						target: state.target
					};
				}

				state.last = last;

				renderFeedback(state, diff, context, canvas, bufferContext, bufferCanvas)
				break;
		}

		// reset state
		state.lastPosition = {};
		state.path         = [];

		countdown(state.restart, 3000, "restarting in...");
	}, 1000);
	// stop drawing the circle

	/*
		TODO:
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

function updateCanvasSize(canvas, event){
	const { innerWidth, innerHeight } = event.target;
	canvas.height = innerHeight;
	canvas.width  = innerWidth
}// updateCanvasSize


//////////////////////////
// UTILS -----------------
//////////////////////////
function random(min, max){

	return Math.floor(Math.random() * (max - min + 1) + min);
}// random

function countdown(callback, remaining, message){
	if(remaining > 0){
		const text = `${message} ${remaining / 1000}s`;
		console.log(text);
		setTimeout(() => countdown(callback, remaining-1000, message), 1000);
	} else callback();
}//countdown

function drawCircle(context, { x, y, radius }, color = "#DDDDDD", overlap = "source-over", stroke){

	// define which composite-mode to use for cutting-out
	context.globalCompositeOperation = overlap;

	// draw the circle path
	context.moveTo(x, y);
	context.beginPath();
	context.arc(x, y, radius, 0, Math.PI * 2)
	context.closePath();

	// style the circle
	if(stroke){
		context.strokeStyle = color;
		context.stroke();
	} else {
		context.fillStyle = color;            
		context.fill();
	}

}// drawCircle

function drawPath(target, context, canvas, path, color = "#000000", overlap = "source-over", stroke, normalise){

	// define which composite-mode to use for cutting-out
	context.globalCompositeOperation = overlap;

	let multiplier, offsetX, offsetY;
	if(normalise){
		const { height, width } = canvas;
		const { radius }        = target;
		const ratio             = (height / (radius * 2));

		multiplier       = ratio;
		offsetX          = ((width / 2) - (radius * 2));
		offsetY          = ((height / 2) - radius);
	} else {
		multiplier = 1;
		offsetX    = 0;
		offsetY    = 0;
	}

	// console.log({ normalise, multiplier, ratio })

	// draw the path
	context.beginPath();
	for(let index in path){
		const { x: rawX, y: rawY } = path[index];
		const x = ((rawX - offsetX) * multiplier);
		const y = ((rawY - offsetY) * multiplier);

		if(index === 0) context.moveTo(x, y);
		else            context.lineTo(x, y);
	}
	// context.closePath();

	// style the path
	if(stroke){
		context.lineWidth   = window.innerHeight / 100; //3;
		context.strokeStyle = color;
		context.stroke();
	}
	else {
		context.fillStyle = color;
		context.fill()	
	}

	return 
}// drawPath

function drawDiff(source, target){

	target("source-over");
	source("source-atop");
}// drawDiff

function renderFeedback(state, diffComposite, context, canvas, bufferContext, bufferCanvas){
	const { width, height } = canvas;
	const { 
		ui: { 
			drawn: { 
				last: lastDrawn,
				best: bestDrawn,
				optimal: optimalDrawn
			},
			score: {
				last: lastScoreEl,
				best: bestScoreEl
			}
		},
		last: { 
			path: lastPath,
			score: lastScore
		},
		best: { 
			path: bestPath,
			score: bestScore
		},
	} = state;

	// draw the best user-circle in the corner of the UI
	// NOTE: currently draws at the wrong ratio because it's being compared with the new target, not its original
	drawPath(state.best.target, bufferContext, bufferCanvas, bestPath, "#00FF00", "source-over", true, true);
	const bestDrawnSrc = bufferCanvas.toDataURL();
	bestDrawn.src      = bestDrawnSrc;
	bufferContext.clearRect(0, 0, width, height);

	// draw the last user-circle in the corner of the UI
	drawPath(state.last.target, bufferContext, bufferCanvas, lastPath, "#000000", "source-over", true, true);
	const lastDrawnSrc = bufferCanvas.toDataURL();
	lastDrawn.src      = lastDrawnSrc;
	bufferContext.clearRect(0, 0, width, height);

	// draw the optimal circle
	drawCircle(bufferContext, { 
		x: window.innerWidth / 1.9,
		y: window.innerHeight / 2, 
		radius: window.innerHeight/2 
	}, "#ff0000", "source-over", true);
	const optimalSrc = bufferCanvas.toDataURL();
	optimalDrawn.src = optimalSrc;
	bufferContext.clearRect(0, 0, width, height);


	// output the last score
	lastScoreEl.textContent = lastScore;
	lastScoreEl.setAttribute("aria-value", lastScore);

	// output the bests core
	bestScoreEl.textContent = bestScore;
	bestScoreEl.setAttribute("aria-value", bestScore);

	
	// draw the coffeestain
	context.putImageData(diffComposite, 0, 0, 0, 0, width, height);
}// renderFeedback

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
	const userInput   = drawPath.bind(true, state, context, canvas, path);
	const targetInput = drawCircle.bind(true, context, target);


	// LET THE DIFFING COMMENCE
	// --------------------------------file:///C:/Users/Pookage/Projects/web/circle-tool/index.html----
	// FIRST DIFF
	// determines how too far IN you are (black is bad)
	drawDiff(
		userInput.bind(true, "#FFFFFF"),
		targetInput.bind(true, "#000000"),
	);
	const { diff: innerDiff, size: innerSize } = await generateImage(state, context, canvas, bufferContext, bufferCanvas);

	// SECOND DIFF
	// determines how too far OUT you are (black is bad)
	drawDiff(
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
	const score        = Math.min((percentage * 100).toFixed(2), 100);

	return score;
}// calculateScore