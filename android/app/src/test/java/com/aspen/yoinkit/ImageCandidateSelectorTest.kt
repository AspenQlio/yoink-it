package com.aspen.yoinkit

import org.json.JSONArray
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ImageCandidateSelectorTest {

    private fun format(url: String, ext: String, width: Int = 0, height: Int = 0) =
        JSONObject()
            .put("url", url)
            .put("ext", ext)
            .put("width", width)
            .put("height", height)

    private fun thumbnail(url: String, width: Int = 0, height: Int = 0) =
        JSONObject().put("url", url).put("width", width).put("height", height)

    @Test
    fun `carousel keeps one candidate per entry in order`() {
        val entries = listOf(
            JSONObject().put("formats", JSONArray().put(format("https://cdn/a1.jpg", "jpg", 1080, 1080))),
            JSONObject().put("formats", JSONArray().put(format("https://cdn/a2.jpg", "jpg", 1080, 1350))),
            JSONObject().put("formats", JSONArray().put(format("https://cdn/a3.jpg", "jpg", 1080, 1920)))
        )

        val candidates = ImageCandidateSelector.selectAll(entries)

        assertEquals(3, candidates.size)
        assertEquals(listOf("https://cdn/a1.jpg", "https://cdn/a2.jpg", "https://cdn/a3.jpg"), candidates.map { it.url })
    }

    @Test
    fun `picks the largest image format and ignores video formats`() {
        val entry = JSONObject().put(
            "formats",
            JSONArray()
                .put(format("https://cdn/video.mp4", "mp4", 1920, 1080))
                .put(format("https://cdn/small.jpg", "jpg", 320, 320))
                .put(format("https://cdn/big.jpg", "jpg", 1440, 1440))
                .put(format("https://cdn/audio.m4a", "m4a"))
        )

        val best = ImageCandidateSelector.selectFrom(entry)

        assertEquals("https://cdn/big.jpg", best?.url)
        assertEquals(1440 * 1440, best?.area)
    }

    @Test
    fun `falls back to thumbnails when no image format exists`() {
        val entry = JSONObject()
            .put("formats", JSONArray().put(format("https://cdn/only-video.mp4", "mp4", 1920, 1080)))
            .put(
                "thumbnails",
                JSONArray()
                    .put(thumbnail("https://cdn/t640.jpg", 640, 640))
                    .put(thumbnail("https://cdn/t1080.jpg?stp=dst-jpg", 1080, 1350))
            )

        val best = ImageCandidateSelector.selectFrom(entry)

        assertEquals("https://cdn/t1080.jpg?stp=dst-jpg", best?.url)
        assertEquals(1080, best?.width)
        assertEquals(1350, best?.height)
        assertEquals("jpg", best?.ext)
    }

    @Test
    fun `media format wins over a larger thumbnail`() {
        val entry = JSONObject()
            .put("formats", JSONArray().put(format("https://cdn/original.png", "png", 1080, 1080)))
            .put("thumbnails", JSONArray().put(thumbnail("https://cdn/thumb.jpg", 4000, 4000)))

        assertEquals("https://cdn/original.png", ImageCandidateSelector.selectFrom(entry)?.url)
    }

    @Test
    fun `last thumbnail wins when dimensions are absent`() {
        val entry = JSONObject().put(
            "thumbnails",
            JSONArray()
                .put(thumbnail("https://cdn/small.jpg"))
                .put(thumbnail("https://cdn/large.webp"))
        )

        val best = ImageCandidateSelector.selectFrom(entry)

        assertEquals("https://cdn/large.webp", best?.url)
        assertEquals("webp", best?.ext)
        assertEquals(0, best?.area)
    }

    @Test
    fun `video only entry yields no candidate instead of throwing`() {
        val entry = JSONObject()
            .put("formats", JSONArray().put(format("https://cdn/video.mp4", "mp4", 1920, 1080)))
            .put("thumbnails", JSONArray())

        assertNull(ImageCandidateSelector.selectFrom(entry))
        assertTrue(ImageCandidateSelector.selectAll(listOf(entry)).isEmpty())
    }

    @Test
    fun `entry without any media metadata yields no candidate`() {
        assertNull(ImageCandidateSelector.selectFrom(JSONObject().put("id", "abc")))
    }

    @Test
    fun `jpeg and heif extensions are normalized`() {
        assertEquals("jpg", ImageCandidateSelector.normalizeExt("JPEG"))
        assertEquals("heic", ImageCandidateSelector.normalizeExt("heif"))
        assertTrue(ImageCandidateSelector.isImageExt("WEBP"))
        assertEquals(false, ImageCandidateSelector.isImageExt("mp4"))
        assertEquals(false, ImageCandidateSelector.isImageExt(null))
    }

    @Test
    fun `extension is inferred from url path ignoring query string`() {
        assertEquals("jpg", ImageCandidateSelector.extFromUrl("https://cdn/photo.jpg?stp=dst-jpg&x=1"))
        assertEquals("png", ImageCandidateSelector.extFromUrl("https://cdn/photo.PNG#frag"))
        assertEquals("jpg", ImageCandidateSelector.extFromUrl("https://cdn/photo"))
        assertEquals("jpg", ImageCandidateSelector.extFromUrl("https://cdn/noext"))
    }

    @Test
    fun `variants are ordered best first`() {
        val entry = JSONObject().put(
            "formats",
            JSONArray()
                .put(format("https://cdn/small.jpg", "jpg", 320, 320))
                .put(format("https://cdn/big.jpg", "jpg", 1440, 1440))
                .put(format("https://cdn/medium.jpg", "jpg", 640, 640))
        )

        val variants = ImageCandidateSelector.variantsFrom(entry)

        assertEquals(
            listOf("https://cdn/big.jpg", "https://cdn/medium.jpg", "https://cdn/small.jpg"),
            variants.map { it.url }
        )
    }

    @Test
    fun `media format is listed before a larger thumbnail so the original stays first`() {
        val entry = JSONObject()
            .put("formats", JSONArray().put(format("https://cdn/original.png", "png", 1080, 1080)))
            .put(
                "thumbnails",
                JSONArray()
                    .put(thumbnail("https://cdn/thumb-small.jpg", 320, 320))
                    .put(thumbnail("https://cdn/thumb-big.jpg", 4000, 4000))
            )

        val variants = ImageCandidateSelector.variantsFrom(entry)

        assertEquals("https://cdn/original.png", variants.first().url)
        assertEquals(
            listOf("https://cdn/thumb-big.jpg", "https://cdn/thumb-small.jpg"),
            variants.drop(1).map { it.url }
        )
    }

    @Test
    fun `repeated url across formats and thumbnails is offered once`() {
        val entry = JSONObject()
            .put("formats", JSONArray().put(format("https://cdn/same.jpg", "jpg", 1080, 1080)))
            .put("thumbnails", JSONArray().put(thumbnail("https://cdn/same.jpg", 1080, 1080)))

        val variants = ImageCandidateSelector.variantsFrom(entry)

        assertEquals(1, variants.size)
        assertEquals("https://cdn/same.jpg", variants.first().url)
    }

    @Test
    fun `entries without images are skipped and indexes keep their original position`() {
        val entries = listOf(
            JSONObject().put("formats", JSONArray().put(format("https://cdn/first.jpg", "jpg", 1080, 1080))),
            JSONObject().put("formats", JSONArray().put(format("https://cdn/clip.mp4", "mp4", 1920, 1080))),
            JSONObject().put("formats", JSONArray().put(format("https://cdn/third.jpg", "jpg", 1080, 1350)))
        )

        val grouped = ImageCandidateSelector.entryImages(entries)

        assertEquals(listOf(1, 3), grouped.map { it.index })
        assertEquals("https://cdn/first.jpg", grouped.first().best.url)
        assertEquals(1, grouped.first().variants.size)
    }

    @Test
    fun `selectFrom stays the best variant so existing callers are unaffected`() {
        val entry = JSONObject()
            .put("formats", JSONArray().put(format("https://cdn/big.jpg", "jpg", 1440, 1440)))
            .put("thumbnails", JSONArray().put(thumbnail("https://cdn/thumb.jpg", 320, 320)))

        assertEquals(
            ImageCandidateSelector.variantsFrom(entry).first().url,
            ImageCandidateSelector.selectFrom(entry)?.url
        )
    }
}