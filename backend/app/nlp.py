import re
import nltk
from nltk.sentiment import SentimentIntensityAnalyzer
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer
from nltk.tokenize import word_tokenize

try:
    import spacy
    try:
        _SPACY_NLP = spacy.load("en_core_web_sm", disable=["ner", "parser"])
    except OSError:
        _SPACY_NLP = None  # Optional model; NLTK lemmatizer remains the local fallback.
except ImportError:
    _SPACY_NLP = None

# Downloads are attempted once at startup; if the machine is offline, provide a clear setup error.
_RESOURCES = {
    "tokenizers/punkt": "punkt",
    "tokenizers/punkt_tab": "punkt_tab",
    "corpora/stopwords": "stopwords",
    "corpora/wordnet": "wordnet",
    "sentiment/vader_lexicon": "vader_lexicon",
}

def ensure_nltk_resources():
    for path, package in _RESOURCES.items():
        try:
            nltk.data.find(path)
        except LookupError:
            try:
                nltk.download(package, quiet=True)
            except Exception:
                pass

def analyze_text(raw_text: str):
    if not isinstance(raw_text, str) or not raw_text.strip():
        raise ValueError("Please enter some text before analyzing.")
    raw_text = raw_text.strip()
    if len(raw_text) > 20000:
        raise ValueError("Text must be 20,000 characters or fewer.")
    ensure_nltk_resources()
    try:
        tokens = word_tokenize(raw_text)
        stop_words = set(stopwords.words("english"))
        lemmatizer = WordNetLemmatizer()
        cleaned_tokens = []
        for token in tokens:
            normalized = token.lower()
            if re.fullmatch(r"[a-zA-Z']+", normalized) and normalized not in stop_words:
                lemma = normalized
                if _SPACY_NLP is not None:
                    doc = _SPACY_NLP(normalized)
                    if doc and doc[0].lemma_ and doc[0].lemma_ != "-PRON-":
                        lemma = doc[0].lemma_.lower()
                else:
                    lemma = lemmatizer.lemmatize(normalized)
                if lemma:
                    cleaned_tokens.append(lemma)
        processed = " ".join(cleaned_tokens) or re.sub(r"\s+", " ", raw_text.lower()).strip()
        analyzer = SentimentIntensityAnalyzer()
        scores = analyzer.polarity_scores(raw_text)
    except LookupError as exc:
        raise RuntimeError("NLP language resources are unavailable. Check your internet connection and restart the API.") from exc
    compound = float(scores["compound"])
    sentiment = "positive" if compound >= 0.05 else "negative" if compound <= -0.05 else "neutral"
    return {
        "processed_text": processed,
        "sentiment": sentiment,
        "positive": round(float(scores["pos"]), 4),
        "neutral": round(float(scores["neu"]), 4),
        "negative": round(float(scores["neg"]), 4),
        "compound": round(compound, 4),
        "token_count": len(cleaned_tokens),
    }
