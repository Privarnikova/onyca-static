/**
 * Onyca Digital — базовая функциональная логика (Этап 0-1).
 *
 * Анимационный слой (магнитные кнопки, шоурил, marquee логотипов и т.д. —
 * ТЗ, раздел 03) сюда сознательно не включён: он идёт вторым проходом
 * (см. PLAN.md, этап 5), после того как страницы работают функционально,
 * и часть решений там прямо помечена «обсудить» с заказчиком.
 */

( function () {
	'use strict';

	/**
	 * Хедер: статичен на первом экране, при скролле вниз скрывается,
	 * при скролле вверх — появляется (ТЗ, п. 03-01).
	 */
	function initHeaderScroll() {
		var header = document.querySelector( '[data-site-header]' );
		if ( ! header ) {
			return;
		}

		var lastScrollY = window.scrollY;
		var headerHeight = header.offsetHeight;

		window.addEventListener(
			'scroll',
			function () {
				var currentScrollY = window.scrollY;

				if ( currentScrollY <= headerHeight ) {
					header.classList.remove( 'is-hidden' );
				} else if ( currentScrollY > lastScrollY ) {
					header.classList.add( 'is-hidden' );
				} else if ( currentScrollY < lastScrollY ) {
					header.classList.remove( 'is-hidden' );
				}

				lastScrollY = currentScrollY;
			},
			{ passive: true }
		);
	}

	/**
	 * Бургер-меню — открытие/закрытие.
	 */
	function initBurgerMenu() {
		var toggle = document.querySelector( '[data-burger-toggle]' );
		var menu = document.getElementById( 'burger-menu' );

		if ( ! toggle || ! menu ) {
			return;
		}

		/**
		 * Высота панели — до низа вьюпорта от её РЕАЛЬНОЙ позиции (не
		 * фиксированные 100vh: панель начинается на top:100% от шапки,
		 * а не от 0, и если шапка ещё не «прилипла» (например, в админке
		 * до скролла её сдвигает вниз wp-adminbar), 100vh уводит низ
		 * панели ЗА пределы вьюпорта — Telegram/email оказывались
		 * недостижимы даже через прокрутку самой панели). Пересчитывается
		 * при открытии и при resize, пока меню открыто.
		 */
		function setMenuHeight() {
			var top = menu.getBoundingClientRect().top;
			menu.style.height = ( window.innerHeight - top ) + 'px';
		}

		/**
		 * Блокировка скролла, пока меню открыто. Через overflow на <html>, а
		 * НЕ через body{position:fixed}: fixed делает body позиционированным
		 * предком, и панель WP admin bar (ниже 783px она position:absolute)
		 * начинает ездить вместе с body, а её компенсация
		 * html.wp-toolbar{padding-top} перестаёт действовать — шапку с лого и
		 * крестиком накрывало чёрной панелью. С overflow страница остаётся в
		 * потоке: админ-бар, шапка и панель стоят там же, где и до открытия.
		 * Позицию прокрутки overflow сохраняет сам, восстанавливать её после
		 * закрытия не нужно.
		 */
		function lockScroll() {
			var scrollbar = window.innerWidth - document.documentElement.clientWidth;

			document.documentElement.style.overflow = 'hidden';

			// Чтобы контент не дёрнулся вбок на ширину исчезнувшего скроллбара.
			if ( scrollbar > 0 ) {
				document.documentElement.style.paddingRight = scrollbar + 'px';
			}
		}

		function unlockScroll() {
			document.documentElement.style.overflow = '';
			document.documentElement.style.paddingRight = '';
		}

		function closeMenu() {
			toggle.setAttribute( 'aria-expanded', 'false' );
			menu.hidden = true;
			unlockScroll();
		}

		toggle.addEventListener( 'click', function () {
			var isOpen = toggle.getAttribute( 'aria-expanded' ) === 'true';

			if ( isOpen ) {
				closeMenu();
				return;
			}

			toggle.setAttribute( 'aria-expanded', 'true' );
			menu.hidden = false;
			lockScroll();
			setMenuHeight();
		} );

		window.addEventListener( 'resize', function () {
			if ( toggle.getAttribute( 'aria-expanded' ) !== 'true' ) {
				return;
			}

			/*
			 * Выше 1200 бургера нет — там десктопная шапка с полным меню.
			 * Если растянуть окно с открытой панелью, её стили (они целиком
			 * внутри @media max-width:1200) отваливаются, и панель остаётся
			 * висеть поверх страницы голым списком, а скролл — заблокирован.
			 * Поэтому на выходе из планшетного диапазона меню закрываем.
			 */
			if ( window.matchMedia( '(min-width: 1201px)' ).matches ) {
				closeMenu();
				return;
			}

			setMenuHeight();
		} );

		menu.querySelectorAll( '.menu-item-has-children > a' ).forEach( function ( link ) {
			link.addEventListener( 'click', function ( e ) {
				e.preventDefault();
				link.closest( '.menu-item-has-children' ).classList.toggle( 'is-open' );
			} );
		} );
	}

	/**
	 * Табы-фильтры на архивах блога/проектов (ТЗ, п. 05-01, 05-02).
	 * Работают через query-параметры (?topic=, ?industry=, ?project_service=),
	 * серверная логика — inc/query-filters.php. Несколько тегов внутри одной
	 * группы можно выбрать одновременно (переключение toggle), клик
	 * перезагружает страницу с обновлёнными параметрами.
	 */
	function initFilterTabs() {
		var groups = document.querySelectorAll( '[data-filter-group]' );

		if ( ! groups.length ) {
			return;
		}

		groups.forEach( function ( group ) {
			var paramName = group.getAttribute( 'data-filter-group' );
			var url = new URL( window.location.href );
			var activeSlugs = ( url.searchParams.get( paramName ) || '' )
				.split( ',' )
				.filter( Boolean );

			group.querySelectorAll( '.filter-tab' ).forEach( function ( tab ) {
				var slug =
					tab.getAttribute( 'data-topic-slug' ) ||
					tab.getAttribute( 'data-industry-slug' ) ||
					tab.getAttribute( 'data-service-slug' );

				if ( activeSlugs.indexOf( slug ) !== -1 ) {
					tab.classList.add( 'is-active' );
				}

				tab.addEventListener( 'click', function () {
					var nextUrl = new URL( window.location.href );
					var slugs = ( nextUrl.searchParams.get( paramName ) || '' )
						.split( ',' )
						.filter( Boolean );

					var index = slugs.indexOf( slug );
					if ( index === -1 ) {
						slugs.push( slug );
					} else {
						slugs.splice( index, 1 );
					}

					if ( slugs.length ) {
						nextUrl.searchParams.set( paramName, slugs.join( ',' ) );
					} else {
						nextUrl.searchParams.delete( paramName );
					}

					window.location.href = nextUrl.toString();
				} );
			} );
		} );
	}

	/**
	 * Пилюли-табы «Ваш проект» в форме на Контактах (.tab-pill, см.
	 * components/tabs.css) — локальный toggle-выбор, несколько сразу,
	 * без перезагрузки страницы (это поле формы, не фильтр архива, как
	 * initFilterTabs выше — тут не нужны query-параметры). Что делать с
	 * выбором при отправке — часть этапа «Формы и интеграции».
	 */
	/**
	 * Валидация формы на Контактах. Состояние «Ошибка» — Figma (1920
	 * 1236:1915 и одноимённые узлы на 1600/1200/700/360): обязательны тег
	 * проекта, email, бюджет и согласие. Подписи этих групп краснеют, у
	 * согласия дополнительно краснеет контрол и появляется сообщение.
	 *
	 * Проверка своя, а не браузерная (форма с novalidate): встроенная
	 * показала бы свой пузырь и не дала бы состояние из макета.
	 */
	function initContactForm() {
		var form = document.querySelector( '.contact-form' );

		if ( ! form ) {
			return;
		}

		var consentError = form.querySelector( '[data-consent-error]' );

		function group( name ) {
			return form.querySelector( '[data-required-group="' + name + '"]' );
		}

		function mark( el, hasError ) {
			if ( ! el ) {
				return hasError;
			}

			el.classList.toggle( 'is-error', hasError );

			return hasError;
		}

		function checks() {
			var email = form.querySelector( '[name="contact_email"]' );

			return {
				tags: ! form.querySelector( '.tab-pill.is-selected' ),
				// Точный разбор адреса тут не нужен: письмо всё равно
				// проверяется на сервере, здесь — только форма записи.
				email: ! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test( email.value.trim() ),
				budget: ! form.querySelector( '[name="contact_budget"]:checked' ),
				consent: ! form.querySelector( '[name="contact_consent"]' ).checked
			};
		}

		function validate() {
			var state = checks();
			var consentControl = form.querySelector( '[name="contact_consent"]' );

			mark( group( 'tags' ), state.tags );
			mark( group( 'email' ), state.email );
			mark( group( 'budget' ), state.budget );
			mark( group( 'consent' ), state.consent );

			consentControl.classList.toggle( 'is-required-error', state.consent );
			consentError.hidden = ! state.consent;

			return ! ( state.tags || state.email || state.budget || state.consent );
		}

		form.addEventListener( 'submit', function ( event ) {
			if ( ! validate() ) {
				event.preventDefault();
			}
		} );

		/*
		 * Пока ошибка показана, снимаем её сразу, как только поле
		 * исправили, — иначе красное остаётся висеть до следующей отправки.
		 */
		form.addEventListener( 'input', function () {
			if ( form.querySelector( '.is-error' ) ) {
				validate();
			}
		} );

		form.addEventListener( 'change', function () {
			if ( form.querySelector( '.is-error' ) ) {
				validate();
			}
		} );

		form.addEventListener( 'click', function ( event ) {
			if ( event.target.closest( '.tab-pill' ) && form.querySelector( '.is-error' ) ) {
				validate();
			}
		} );
	}

	function initTabPills() {
		var pills = document.querySelectorAll( '.tab-pill' );

		pills.forEach( function ( pill ) {
			pill.addEventListener( 'click', function () {
				pill.classList.toggle( 'is-selected' );
			} );
		} );
	}

	/**
	 * Виджет времени на странице «Контакты» — день недели, часы и статус
	 * «работаем/отдыхаем» (будни, 10:00–19:00 МСК) пересчитываются на
	 * клиенте каждые 30 секунд, а не только при перезагрузке страницы.
	 */
	function initMoscowClock() {
		var dayEl = document.querySelector( '[data-msk-day]' );
		var clockEl = document.querySelector( '[data-msk-clock]' );
		var statusEl = document.querySelector( '[data-msk-status]' );

		if ( ! dayEl && ! clockEl && ! statusEl ) {
			return;
		}

		function render() {
			var now = new Date();
			var moscowNow = new Date(
				now.toLocaleString( 'en-US', { timeZone: 'Europe/Moscow' } )
			);
			var dayOfWeek = moscowNow.getDay(); // 0 (вс) .. 6 (сб)
			var hours = moscowNow.getHours();
			var isWorking = dayOfWeek >= 1 && dayOfWeek <= 5 && hours >= 10 && hours < 19;

			if ( dayEl ) {
				var dayName = new Intl.DateTimeFormat( 'ru-RU', {
					weekday: 'long',
					timeZone: 'Europe/Moscow',
				} ).format( now );
				dayEl.textContent = dayName.charAt( 0 ).toUpperCase() + dayName.slice( 1 );
			}

			if ( clockEl ) {
				var minutes = moscowNow.getMinutes();
				clockEl.textContent =
					String( hours ).padStart( 2, '0' ) + ':' + String( minutes ).padStart( 2, '0' );
			}

			if ( statusEl ) {
				statusEl.textContent = isWorking ? 'Сейчас работаем' : 'Сейчас отдыхаем';
			}
		}

		render();
		setInterval( render, 1000 * 30 );
	}

	document.addEventListener( 'DOMContentLoaded', function () {
		initHeaderScroll();
		initBurgerMenu();
		initFilterTabs();
		initTabPills();
		initContactForm();
		initMoscowClock();
	} );
} )();
