from app.nlp import analyze_text

def test_positive_sentiment():
    result = analyze_text("I feel happy, hopeful, and excited about today!")
    assert result["sentiment"] == "positive"
    assert result["compound"] > 0.05

def test_negative_sentiment():
    result = analyze_text("I am disappointed and very sad about this terrible day.")
    assert result["sentiment"] == "negative"
    assert result["compound"] < -0.05

def test_empty_text_rejected():
    try:
        analyze_text("   ")
        assert False, "Expected ValueError"
    except ValueError:
        assert True
