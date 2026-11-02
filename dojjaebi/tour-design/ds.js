/* 위쪽 바 그림자: 스크롤하면 .scrolled */
(function(){var t=document.getElementById('top');if(!t)return;
function f(){t.classList.toggle('scrolled',(window.scrollY||document.documentElement.scrollTop)>2);}
addEventListener('scroll',f,{passive:true});f();})();
