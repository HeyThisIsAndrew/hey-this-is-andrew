import sys
import os
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../scripts/anti-gravity')))

from content_ingestion import extract_rich_metadata

def test_marvel_movie():
    metadata = extract_rich_metadata(["marvel", "movie"])
    assert metadata["primary_category"] == "Movies", f"Expected Movies, got {metadata['primary_category']}"
    print("test_marvel_movie passed")

def test_playstation_gaming():
    metadata = extract_rich_metadata(["playstation", "gaming"])
    assert metadata["primary_category"] == "Gaming", f"Expected Gaming, got {metadata['primary_category']}"
    print("test_playstation_gaming passed")

def test_marvel_uncategorized():
    metadata = extract_rich_metadata(["marvel"])
    assert metadata["primary_category"] == "Uncategorized", f"Expected Uncategorized, got {metadata['primary_category']}"
    print("test_marvel_uncategorized passed")

if __name__ == "__main__":
    test_marvel_movie()
    test_playstation_gaming()
    test_marvel_uncategorized()
    print("All tests passed!")
