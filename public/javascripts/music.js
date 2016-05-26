// music.js

window.AudioContext = window.AudioContext || window.webkitAudioContext || window.mozAudioContext || window.msAudioContext;
window.requestAnimFrame = (function() {
	return window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || window.oRequestAnimationFrame || window.msRequestAnimationFrame ||
		function( /* function FrameRequestCallback */ callback, /* DOMElement Element */ element) {
			return window.setTimeout(callback, 1000 / 60);
		};
})();
window.onload = tabLi();

function tabLi() {
	var musicList;	//音乐列表
	var styleList;	//画布风格列表
	var vol;		//音量调节按键
	var can;		//画布
	var box;		//画布容器
	var ctx;		//画笔
	var width;		//画布宽度
	var height;		//画布高度

	var musicSelected;	//选中的音乐标签
	var styleSelected;	//选中的风格标签
	var loopBtn;	//循环按钮
	var PSBtn;		//播放暂停按钮
	var line;		//柱状风格fillStyle
	var play;		//正在播放的音频
	var num;		//标签点击次数, 用于识别每一次点击
	var size;		//频谱精度

	var XHR;		//XMLHttpRequest
	var ac;			//音频上下文
	var analyser;	//分析节点
	var gain;		//控制节点
	var analyserArr;//分析数组
	var startTime;	//开始播放时间(包括暂停后开始)
	var playTime;	//暂停之前已播放时间
	var nowTime;	//实时已播放的时间
	var isStop;		//是否暂停
	var loop;		//是否循环
	var doc;

	init();

	//初始化函数//
	function init() {
		musicList = $('#music-list li');
		styleList = $('#canvas-style li');
		loopBtn = $('#loop')[0];
		PSBtn = $('#play-stop')[0];
		vol = $('#volume input')[0];
		can = $('#can')[0];
		box = $('#box')[0];
		ctx = can.getContext('2d');

		styleSelected = styleList[0];
		num = 0;
		size = 32;

		XHR = new XMLHttpRequest();
		ac = new AudioContext();
		analyser = ac.createAnalyser();
		gain = ac[ac.createGain ? "createGain" : "createGainNode"]();
		analyserArr = new Uint8Array(analyser.frequencyBinCount);
		isStop = true;
		loop = false;

		resize();
		window.onresize = resize;
		draw.type='col';
		analyser.fftSize = size * 2;
		analyser.connect(gain);
		visualizer();
		gain.connect(ac.destination);

		for(var i = 0; i < musicList.length; i++) {
			(function(i) {
				musicList[i].onclick = function() {
					if(musicSelected)	musicSelected.className = "";
					this.className = "selected";
					musicSelected = this;

					load("/media/" + this.title, this.title);
					if(play)	play[play.stop ? "stop" : "noteOff"]();
				};
			}(i));
		}

		for(var i = 0; i < styleList.length; i++) {
			(function(i) {
				styleList[i].onclick = function() {
					styleSelected.className = "";
					this.className = "selected";
					draw.type = this.getAttribute("data-type");
					styleSelected = this;
				};
			}(i));
		}

		loopBtn.onclick = function() {
			this.className = this.className == "off" ? "on" : "off";
			loop = !loop;
			play.loop = loop;
		}

		PSBtn.onclick = function() {
			if(this.className == 'stop') {
				//暂停
				playTime = (playTime + (ac.currentTime - startTime)) % play.buffer.duration;
				this.className ='play';
				play[play.start ? 'stop' : 'noteOff'](0);
				isStop = true;
			} else {
				//播放
				this.className = 'stop';
				startTime = ac.currentTime;
				createBufferNode(play.buffer, playTime);
				isStop = false;
			}
		}

		vol.onmousedown = function() {
			this.onmousemove = function() {
				changeVolume(this.value / this.max);
			};
		};

		vol.onmouseup = function() {
			this.onmousemove = null;
		};
	}

	//绘图函数//
	function draw (array) {
		ctx.clearRect(0, 0, width, height);

		if(draw.type == "col") {
			var w = width / size;
			for(var i = 0; i < size; i++) {
				var o = doc[i];
				var h = array[i] / 255 * height;
				if(h > o.h)	o.h = h;
				ctx.fillStyle = line;
				ctx.fillRect(w * i, height - h, w * 0.6, h);	//fillRect(左上角x, 左上角y, 绘制宽度, 绘制高度);
				ctx.fillStyle = "#fff";
				ctx.fillRect(w * i, height - 2 - o.h--, w * 0.6, 2);
			}
		} else if(draw.type == "doc") {
			for(var i = 0; i < size; i++) {
				var o = doc[i];
				var r = array[i] / 255 * (height > width ? width : height) * 0.18;

				ctx.beginPath();
				ctx.arc(o.x, o.y, (r > 10 ? r : 10), 0, Math.PI*2);
				ctx.closePath();
				
				if((o.x+=o.vx) > width)	updateDoc(o);
				var g = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, (r > 10 ? r : 10));
				g.addColorStop(0, "#fff");
				g.addColorStop(1, o.color);
				ctx.fillStyle = g;
				ctx.fill();

				// ctx.strokeStyle = "#fff";
				// ctx.stroke();
			}
		}
	}

	//圆点获取函数//
	function getDoc() {
		doc = [];
		for(var i = 0; i < size; i++) {
			doc.push(updateDoc({
				x: 0,
				y: 0,
				vx: 0,
				color: 'rgba(0,0,0,0)',
				h: 0
			}, true));
		}
	}

	//圆点更新函数//
	function updateDoc(obj, isInit) {
		obj.x = !!isInit ? random(0, width) : 0;
		obj.y = random(0, height);
		obj.vx = random(1, 4);
		obj.color = "rgba(" + random(0, 255) + ", " + random(0, 255) +", "+ random(0, 255)  +", "+ 0 +")";

		return obj;
	}

	//异步请求函数//
	function load(url, title) {
		XHR.abort();
		XHR.open('GET', url);
		XHR.responseType = "arraybuffer";
		XHR.onload = function () {
			var id = ++num;
			
			//延时0.5s预防狂点
			setTimeout(function() {
				if(id != num)	return;
				ac.decodeAudioData(XHR.response, function(buffer) {
					if(id != num)	return;
					createBufferNode(buffer);
					playTime = 0;
				}, function(err) {
					console.log(err);
				});
			},500);
		};
		XHR.send();
	}

	//音频流节点创建函数//
	function createBufferNode(buffer, beginTime) {
		play = ac.createBufferSource();
		play.buffer = buffer;
		play.connect(analyser);
		play.loop = loop;
		play.onended = function() {
			if(!isStop)	PSBtn.onclick();
		}
		startTime = ac.currentTime;
		if(beginTime)	play[play.start ? 'start' : 'noteOn'](0, beginTime);
		else			play[play.start ? 'start' : 'noteOn'](0);
		isStop = false;
	}

	//音频分析函数//
	function visualizer() {
		analyser.getByteFrequencyData(analyserArr);
		draw(analyserArr);
		if(!isStop) {
			nowTime = (playTime + (ac.currentTime - startTime)) % play.buffer.duration;
		}
		window.requestAnimFrame(visualizer);
	}

	//音量改变函数//
	function changeVolume(val) {
		gain.gain.value = val * val;
	}

	//窗口大小改变事件函数//
	function resize() {
		width = box.clientWidth;
		height = box.clientHeight;
		can.width = width;
		can.height = height;
		getDoc();

		line = ctx.createLinearGradient(0, 0, 0, height);
		line.addColorStop(0, 'red');
		line.addColorStop(0.5, 'yellow');
		line.addColorStop(1, 'green');
	}
}

function $(e) {
	return document.querySelectorAll(e);
}

function random(a, b) {
	return	Math.round(Math.random() * (b - a) + a);
}
