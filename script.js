const cartKey = "swatheesh-cart";
const wishlistKey = "swatheesh-wishlist";

function getCart() {
	return JSON.parse(localStorage.getItem(cartKey) || "[]");
}

function saveCart(cart) {
	localStorage.setItem(cartKey, JSON.stringify(cart));
}

function getWishlist() {
	return JSON.parse(localStorage.getItem(wishlistKey) || "[]");
}

function saveWishlist(wishlist) {
	localStorage.setItem(wishlistKey, JSON.stringify(wishlist));
}

function updateCartCount() {
	const cartIcon = document.querySelector(".cart-link");

	if (cartIcon) {
		cartIcon.textContent = "🛍️";
	}
}

function addToCart(button) {
	const card = button.closest(".product-card");
	const image = card.querySelector("img");
	const name = card.querySelector("h3").textContent.trim();
	const price = Number(card.querySelector("p").textContent.replace(/[^0-9]/g, ""));
	const cart = getCart();
	const existingItem = cart.find((item) => item.name === name);

	if (existingItem) {
		existingItem.quantity += 1;
	} else {
		cart.push({ name, price, image: image.getAttribute("src"), quantity: 1 });
	}

	saveCart(cart);
	updateCartCount();
	button.textContent = "ADDED";
	setTimeout(() => {
		button.textContent = "ADD TO BAG";
	}, 1000);
}

window.addToCart = addToCart;

function addProductPageToCart(action) {
	const productInfo = document.querySelector(".product-detail-info");
	const selectedSize = document.querySelector('[data-option-group="size"].selected');
	const selectedColor = document.querySelector('[data-option-group="color"].selected');
	const message = document.querySelector(".selection-message");

	if (!selectedSize || !selectedColor) {
		message.textContent = "Please select a size and colour.";
		return;
	}

	const name = productInfo.querySelector("h1").textContent.trim();
	const price = Number(productInfo.querySelector("h2").textContent.replace(/[^0-9]/g, ""));
	const image = document.querySelector(".product-details img").getAttribute("src");
	const variantName = `${name} - ${selectedColor.textContent} / ${selectedSize.textContent}`;
	const cart = getCart();
	const existingItem = cart.find((item) => item.name === variantName);

	if (existingItem) {
		existingItem.quantity += 1;
	} else {
		cart.push({
			name: variantName,
			price,
			image,
			quantity: 1
		});
	}

	saveCart(cart);
	updateCartCount();

	if (action === "buy") {
		window.location.href = "checkout.html";
	} else {
		message.textContent = "Added to bag.";
	}
}

function getProductFromCard(card) {
	return {
		name: card.querySelector("h3").textContent.trim(),
		price: Number(card.querySelector("p").textContent.replace(/[^0-9]/g, "")),
		image: card.querySelector("img").getAttribute("src")
	};
}

function updateWishlistButton(button, name) {
	const isSaved = getWishlist().some((item) => item.name === name);
	button.textContent = isSaved ? "♥" : "♡";
	button.classList.toggle("liked", isSaved);
	button.setAttribute("aria-label", isSaved ? "Remove from wishlist" : "Add to wishlist");
}

function toggleWishlist(button) {
	const product = getProductFromCard(button.closest(".product-card"));
	const wishlist = getWishlist();
	const itemIndex = wishlist.findIndex((item) => item.name === product.name);

	if (itemIndex >= 0) {
		wishlist.splice(itemIndex, 1);
	} else {
		wishlist.push(product);
	}

	saveWishlist(wishlist);
	updateWishlistButton(button, product.name);
}

function setupWishlistButtons() {
	document.querySelectorAll(".product-card").forEach((card) => {
		const imageContainer = card.querySelector(".product-image");
		if (!imageContainer || imageContainer.querySelector(".wishlist-button")) return;

		const button = document.createElement("button");
		button.className = "wishlist-button";
		button.type = "button";
		button.addEventListener("click", () => toggleWishlist(button));
		imageContainer.appendChild(button);
		updateWishlistButton(button, card.querySelector("h3").textContent.trim());
	});
}

window.setupWishlistButtons = setupWishlistButtons;

function setupProductLinks() {
	document.querySelectorAll('a[href="product.html"]').forEach((link) => {
		const card = link.closest(".product-card");
		if (!card) return;

		const image = card.querySelector("img");
		const name = card.querySelector("h3")?.textContent.trim() || image?.alt || "Product";
		const price = card.querySelector("p")?.textContent.replace(/[^0-9]/g, "") || "0";
		if (!image) return;

		const params = new URLSearchParams({
			name,
			price,
			image: image.getAttribute("src") || ""
		});
		link.href = `product.html?${params.toString()}`;
	});
}

function loadSelectedProduct() {
	if (!document.querySelector(".product-detail-info")) return;

	const params = new URLSearchParams(window.location.search);
	const name = params.get("name");
	const price = params.get("price");
	const image = params.get("image");
	if (!name && !price && !image) return;

	const productImage = document.querySelector(".product-details > a img");
	const productName = document.querySelector(".product-detail-info h1");
	const productPrice = document.querySelector(".product-detail-info h2");
	const productTitle = document.querySelector("title");

	if (image && productImage) {
		productImage.src = image;
		productImage.alt = name || productImage.alt;
	}
	if (name && productName) productName.textContent = name;
	if (price && productPrice) productPrice.textContent = `₹${Number(price).toLocaleString("en-IN")}`;
	if (name && productTitle) productTitle.textContent = `${name} | Swatheesh Menswear`;
}

function filterProductCards(query) {
	const normalizedQuery = query.toLowerCase().trim();
	document.querySelectorAll(".product-card").forEach((card) => {
		const title = card.querySelector("h3").textContent.toLowerCase();
		const image = card.querySelector("img");
		const imageSource = image.getAttribute("src").toLowerCase();
		const imageDetails = `${imageSource} ${image.getAttribute("alt")}`.toLowerCase();
		const isShirtsSearch = normalizedQuery === "shirts" || normalizedQuery === "shirt";
		const isTshirtsSearch = normalizedQuery === "tshirts" || normalizedQuery === "t-shirts" || normalizedQuery === "t-shirt";
		const matchesCategory = isShirtsSearch
			? imageSource.startsWith("shirts ")
			: isTshirtsSearch
				? imageSource.startsWith("tshirts ")
				: `${title} ${imageDetails}`.includes(normalizedQuery);
		card.hidden = !matchesCategory;
	});
}

window.filterProductCards = filterProductCards;

function setupSearch() {
	const searchIcon = document.querySelector(".nav-icons span:first-child");
	if (!searchIcon) return;

	searchIcon.classList.add("search-link");
	searchIcon.textContent = "⌕";
	searchIcon.title = "Search products";
	searchIcon.addEventListener("click", () => {
		let searchBox = document.querySelector(".search-box");
		let created = false;
		if (!searchBox) {
			searchBox = document.createElement("input");
			searchBox.className = "search-box";
			searchBox.type = "search";
			searchBox.placeholder = "Search products";
			searchBox.hidden = false;
			created = true;
			searchIcon.parentElement.insertAdjacentElement("afterend", searchBox);
			searchBox.addEventListener("input", () => {
				filterProductCards(searchBox.value);
			});
			searchBox.addEventListener("keydown", (event) => {
				if (event.key !== "Enter") return;
				const query = searchBox.value.trim();
				if (query && !document.querySelector(".product-card")) {
					window.location.href = `collections.html?search=${encodeURIComponent(query)}`;
				}
			});
		}
		if (!created) searchBox.hidden = !searchBox.hidden;
		if (!searchBox.hidden) searchBox.focus();
	});
}

async function loadDatabaseProductsOnCategoryPage() {
	const pageName = window.location.pathname.split("/").pop();
	const category = {
		"shirts.html": "shirts",
		"tshirts.html": "tshirts",
		"trousers.html": "trousers",
		"jackets.html": "jackets",
		"accessories.html": "accessories"
	}[pageName];
	const productGrid = document.querySelector(".product-grid");
	if (!category || !productGrid) return;

	const apiBase = window.location.protocol === "file:" ? "http://localhost:3000" : "";
	const response = await fetch(`${apiBase}/api/products`);
	if (!response.ok) return;

	const products = await response.json();
	products.filter((product) => product.category === category).forEach((product) => {
		const card = document.createElement("article");
		card.className = "product-card database-product";
		const isOutOfStock = product.stock === 0;
		card.innerHTML = `
			<div class="product-image"><a href="product.html"><img src="${product.image}" alt="${product.name}"></a></div>
			<div class="product-info"><h3>${product.name}</h3><p>₹${product.price}</p><button ${isOutOfStock ? "disabled" : ""}>${isOutOfStock ? "OUT OF STOCK" : "ADD TO BAG"}</button></div>
		`;
		productGrid.appendChild(card);
		if (!isOutOfStock) card.querySelector(".product-info button").addEventListener("click", () => addToCart(card.querySelector(".product-info button")));
	});

	setupWishlistButtons();
	setupProductLinks();
}

document.querySelectorAll(".product-info button").forEach((button) => {
	button.addEventListener("click", () => addToCart(button));
});

document.querySelectorAll(".option-button").forEach((button) => {
	button.addEventListener("click", () => {
		document.querySelectorAll(`[data-option-group="${button.dataset.optionGroup}"]`).forEach((option) => {
			option.classList.remove("selected");
		});
		button.classList.add("selected");
	});
});

document.querySelectorAll(".product-action").forEach((button) => {
	button.addEventListener("click", () => addProductPageToCart(button.dataset.action));
});

const cartIcon = document.querySelector(".nav-icons span:last-child");
if (cartIcon) {
	cartIcon.classList.add("cart-link");
	cartIcon.textContent = "▱";
	cartIcon.title = "Open bag";
	cartIcon.addEventListener("click", () => {
		window.location.href = "cart.html";
	});
}

const wishlistIcon = document.querySelector(".nav-icons span:nth-child(2)");
if (wishlistIcon) {
	wishlistIcon.classList.add("wishlist-link");
	wishlistIcon.textContent = "♡";
	wishlistIcon.title = "Open wishlist";
	wishlistIcon.addEventListener("click", () => {
		window.location.href = "wishlist.html";
	});
}

setupProductLinks();
loadSelectedProduct();

setupWishlistButtons();
setupSearch();
loadDatabaseProductsOnCategoryPage().catch(() => {});
updateCartCount();
